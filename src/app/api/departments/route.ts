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

    const { searchParams } = new URL(request.url);
    const deptId = searchParams.get("id"); // detail view

    const now      = new Date();
    const day30ago = new Date(now); day30ago.setDate(now.getDate() - 30);
    const day7ago  = new Date(now); day7ago.setDate(now.getDate() - 7);

    // ── Detail view for a single department ──────────────────────────
    if (deptId) {
      const dept = await prisma.department.findUnique({
        where: { id: deptId },
        include: {
          units: { include: { _count: { select: { users: true } } } },
          users: {
            where: { isActive: true },
            include: {
              dailyLogs: {
                where: { createdAt: { gte: day30ago } },
                select: { status: true, timeSpent: true, createdAt: true, taskTitle: true },
              },
            },
          },
          kpis: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });

      if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Per-staff stats
      const staffStats = dept.users.map((u) => {
        const logs     = u.dailyLogs;
        const approved = logs.filter((l) => l.status === "APPROVED").length;
        const total    = logs.length;
        const hours    = Math.round(logs.reduce((s, l) => s + (l.timeSpent || 0), 0) * 10) / 10;
        const rate     = total > 0 ? Math.round((approved / total) * 100) : 0;
        const weekLogs = logs.filter((l) => new Date(l.createdAt) >= day7ago).length;
        return {
          id: u.id, name: u.name, email: u.email, role: u.role,
          totalLogs: total, approved, hours, approvalRate: rate, weekLogs,
        };
      }).sort((a, b) => b.totalLogs - a.totalLogs);

      // Department-level log aggregates
      const allLogs  = dept.users.flatMap((u) => u.dailyLogs);
      const approved = allLogs.filter((l) => l.status === "APPROVED").length;
      const rejected = allLogs.filter((l) => l.status === "REJECTED").length;
      const pending  = allLogs.filter((l) => l.status === "SUBMITTED").length;
      const total    = allLogs.length;
      const rate     = total > 0 ? Math.round((approved / total) * 100) : 0;
      const hours    = Math.round(allLogs.reduce((s, l) => s + (l.timeSpent || 0), 0) * 10) / 10;

      // Recent logs
      const recentLogs = await prisma.dailyLog.findMany({
        where: {
          user: { departmentId: deptId },
          createdAt: { gte: day30ago },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, taskTitle: true, status: true, createdAt: true,
          user: { select: { name: true } },
        },
      });

      return NextResponse.json({
        detail: {
          id: dept.id, name: dept.name, shortCode: dept.shortCode,
          category: dept.category, description: dept.description,
          units: dept.units,
          kpis: dept.kpis,
          stats: { total, approved, rejected, pending, rate, hours, staff: dept.users.length },
          staffStats,
          recentLogs,
        },
      });
    }

    // ── List view — all departments with real scores ──────────────────
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { users: true } },
        units:  true,
        users: {
          where: { isActive: true },
          include: {
            dailyLogs: {
              where: { createdAt: { gte: day30ago } },
              select: { status: true, timeSpent: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const enriched = departments.map((dept) => {
      const allLogs  = dept.users.flatMap((u) => u.dailyLogs);
      const approved = allLogs.filter((l) => l.status === "APPROVED").length;
      const total    = allLogs.length;
      const rate     = total > 0 ? Math.round((approved / total) * 100) : 0;
      const hours    = Math.round(allLogs.reduce((s, l) => s + (l.timeSpent || 0), 0) * 10) / 10;
      return {
        id:          dept.id,
        name:        dept.name,
        shortCode:   dept.shortCode,
        category:    dept.category,
        description: dept.description,
        unitCount:   dept.units.length,
        _count:      dept._count,
        totalLogs:   total,
        approvedLogs: approved,
        approvalRate: rate,
        totalHours:  hours,
        status:      rate >= 80 ? "ON_TRACK" : rate >= 60 ? "AT_RISK" : total === 0 ? "NO_DATA" : "BEHIND",
      };
    });

    // Sort by approval rate descending, no-data at bottom
    enriched.sort((a, b) => {
      if (a.status === "NO_DATA" && b.status !== "NO_DATA") return 1;
      if (b.status === "NO_DATA" && a.status !== "NO_DATA") return -1;
      return b.approvalRate - a.approvalRate;
    });

    return NextResponse.json({ departments: enriched });
  } catch (error) {
    console.error("[Departments API]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
