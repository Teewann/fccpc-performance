import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
