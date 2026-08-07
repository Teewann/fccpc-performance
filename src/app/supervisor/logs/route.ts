import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supervisor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!supervisor) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Supervisors see all logs from their department
    const logs = await prisma.dailyLog.findMany({
      where: {
        status: { in: ["SUBMITTED", "APPROVED", "REJECTED"] },
        user: { departmentId: supervisor.departmentId ?? undefined },
      },
      include: {
        user: {
          include: { department: true, unit: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supervisor = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!supervisor) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { logId, action, comment, score } = body;

    if (!logId || !action) {
      return NextResponse.json({ error: "logId and action are required" }, { status: 400 });
    }

    const newStatus =
      action === "approve" ? "APPROVED" :
      action === "reject"  ? "REJECTED" :
      "QUERIED";

    const updated = await prisma.dailyLog.update({
      where: { id: logId },
      data: {
        status: newStatus,
        supervisorId: supervisor.id,
        supervisorComment: comment || null,
        supervisorScore: score ? parseInt(score) : null,
        reviewedAt: new Date(),
      },
    });

    // Create notification for the staff member
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title: `Log ${newStatus.toLowerCase()}`,
        message: `Your log "${updated.taskTitle}" was ${newStatus.toLowerCase()} by your supervisor.${comment ? ` Comment: ${comment}` : ""}`,
        type: newStatus === "APPROVED" ? "SUCCESS" : "WARNING",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: supervisor.id,
        action: `LOG_${newStatus}`,
        detail: `Log ID ${logId} — ${comment || "no comment"}`,
      },
    });

    return NextResponse.json({ success: true, log: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
