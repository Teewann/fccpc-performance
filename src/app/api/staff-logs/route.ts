import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const page     = parseInt(searchParams.get("page")     || "1");
    const limit    = parseInt(searchParams.get("limit")    || "20");
    const status   = searchParams.get("status")   || "ALL";
    const deptId   = searchParams.get("deptId")   || null;
    const userId   = searchParams.get("userId")   || null;
    const dateFrom = searchParams.get("dateFrom") || null;
    const dateTo   = searchParams.get("dateTo")   || null;
    const search   = searchParams.get("search")   || null;

    // Staff can only see their own logs
    // Supervisors/Admin/HR see all logs (or filtered by dept)
    const isPrivileged = ["SUPERVISOR","HR","DIRECTOR","ADMIN","EXECUTIVE"].includes(user.role);

    const where: any = {};

    if (!isPrivileged) {
      where.userId = user.id;
    } else {
      if (userId)  where.userId          = userId;
      if (deptId)  where.user            = { departmentId: deptId };
    }

    if (status !== "ALL") where.status   = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo)   where.date.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { taskTitle:   { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { caseReference: { contains: search, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.dailyLog.findMany({
        where,
        include: {
          user: { include: { department: true, unit: true } },
          supervisor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.dailyLog.count({ where }),
    ]);

    // Summary stats
    const allForStats = await prisma.dailyLog.findMany({
      where: isPrivileged ? (deptId ? { user: { departmentId: deptId } } : {}) : { userId: user.id },
      select: { status: true, timeSpent: true },
    });

    const stats = {
      total:      allForStats.length,
      approved:   allForStats.filter((l) => l.status === "APPROVED").length,
      submitted:  allForStats.filter((l) => l.status === "SUBMITTED").length,
      rejected:   allForStats.filter((l) => l.status === "REJECTED").length,
      totalHours: Math.round(allForStats.reduce((s, l) => s + l.timeSpent, 0) * 10) / 10,
    };

    return NextResponse.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Add ONLY this function to your EXISTING src/app/api/staff-logs/route.ts
// — do not duplicate the import lines, your file already has them.
//
// This replaces the version at supervisor/logs/route.ts (which had no
// authorization check at all — any logged-in staff member could approve
// or score any log, including their own). Delete supervisor/logs/route.ts
// once this is in place, or it'll sit there as an unused, insecure
// duplicate.

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const reviewer = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!reviewer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { logId, status, score, comment } = body; // matches supervisor/page.tsx exactly

    if (!logId || !["APPROVED", "REJECTED", "QUERIED"].includes(status)) {
      return NextResponse.json({ error: "logId and a valid status are required" }, { status: 400 });
    }

    const log = await prisma.dailyLog.findUnique({
      where: { id: logId },
      include: { user: { select: { id: true, name: true, departmentId: true, supervisorId: true } } },
    });
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }
    if (log.status !== "SUBMITTED") {
      return NextResponse.json({ error: "This log has already been reviewed" }, { status: 400 });
    }

    // FIX: the previous version had no authorization check whatsoever.
    const isDesignatedSupervisor = log.user.supervisorId === reviewer.id;
    const isDeptLeadership =
      ["DIRECTOR", "SUPERVISOR"].includes(reviewer.role) &&
      log.user.departmentId === reviewer.departmentId;
    const isOrgWide = ["HR", "ADMIN", "EXECUTIVE"].includes(reviewer.role);

    if (!isDesignatedSupervisor && !isDeptLeadership && !isOrgWide) {
      return NextResponse.json({ error: "You're not authorized to review this log" }, { status: 403 });
    }

    // Score is 0-100, matching the slider already built in supervisor/page.tsx.
    const numericScore = score != null ? parseInt(score, 10) : null;
    if (status === "APPROVED" && (numericScore == null || numericScore < 0 || numericScore > 100)) {
      return NextResponse.json({ error: "A score from 0 to 100 is required to approve" }, { status: 400 });
    }

    const updated = await prisma.dailyLog.update({
      where: { id: logId },
      data: {
        status,
        supervisorId: reviewer.id,
        supervisorScore: status === "APPROVED" ? numericScore : null,
        supervisorComment: comment || null,
        reviewedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: log.user.id,
        title: `Log ${status.toLowerCase()}`,
        message: `Your log "${log.taskTitle}" was ${status.toLowerCase()} by ${reviewer.name}.${comment ? ` Comment: ${comment}` : ""}`,
        type: status === "APPROVED" ? "SUCCESS" : status === "REJECTED" ? "WARNING" : "INFO",
        link: "/daily-log",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: reviewer.id,
        action: `LOG_${status}`,
        detail: `Log ${logId} (${log.taskTitle}) — ${comment || "no comment"}`,
      },
    });

    return NextResponse.json({ success: true, log: updated });
  } catch (error) {
    console.error("PATCH /api/staff-logs error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}