import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET — fetch leave requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPrivileged = ["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(user.role);

    const requests = await prisma.leaveRequest.findMany({
      where: isPrivileged
        ? user.departmentId
          ? { user: { departmentId: user.departmentId } }
          : {}
        : { userId: user.id },
      include: {
        user: { include: { department: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — submit leave request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { type, startDate, endDate, reason } = body;

    if (!type || !startDate || !endDate || !reason?.trim()) {
      return NextResponse.json(
        { error: "Leave type, start date, end date and reason are all required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    if (end < start) {
      return NextResponse.json(
        { error: "End date cannot be before start date" },
        { status: 400 }
      );
    }

    // Calculate working days (Monday–Friday only)
    let days    = 0;
    const cur   = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }

    if (days === 0) {
      return NextResponse.json(
        { error: "Selected dates contain no working days" },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        userId:    user.id,
        type,
        startDate: start,
        endDate:   end,
        days,
        reason:    reason.trim(),
        status:    "PENDING",
      },
      include: {
        user: { include: { department: true } },
      },
    });

    // Notify department Director
    if (user.departmentId) {
      const director = await prisma.user.findFirst({
        where: { departmentId: user.departmentId, role: "DIRECTOR", isActive: true },
        select: { id: true },
      });

      if (director) {
        await prisma.notification.create({
          data: {
            userId:  director.id,
            title:   "New leave request",
            message: `${user.name} applied for ${days}-day ${type.toLowerCase()} leave from ${start.toLocaleDateString("en-GB")} to ${end.toLocaleDateString("en-GB")}.`,
            type:    "INFO",
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LEAVE_REQUEST_SUBMITTED",
        detail: `${type} leave — ${days} working days`,
      },
    });

    return NextResponse.json({ success: true, request: leaveRequest }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH — Director/HR approves or rejects
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const reviewer = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!reviewer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(reviewer.role)) {
      return NextResponse.json(
        { error: "Only Directors and HR can review leave requests" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, status, approverComment } = body;

    if (!requestId || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "requestId and status (APPROVED or REJECTED) are required" },
        { status: 400 }
      );
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status,
        approvedById:    reviewer.id,
        approverComment: approverComment || null,
      },
      include: { user: true },
    });

    // Notify the staff member of the decision
    await prisma.notification.create({
      data: {
        userId:  updated.userId,
        title:   `Leave request ${status.toLowerCase()}`,
        message: `Your ${updated.type.toLowerCase()} leave request (${updated.days} days from ${new Date(updated.startDate).toLocaleDateString("en-GB")}) was ${status.toLowerCase()} by ${reviewer.name}.${approverComment ? ` Comment: ${approverComment}` : ""}`,
        type:    status === "APPROVED" ? "SUCCESS" : "WARNING",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: reviewer.id,
        action: `LEAVE_${status}`,
        detail: `Leave for ${updated.user.name} — ${updated.days} days`,
      },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
