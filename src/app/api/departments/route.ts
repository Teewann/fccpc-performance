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
      const [dept, deptUsers] = await Promise.all([
        prisma.department.findUnique({
          where: { id: deptId },
          include: {
            units: { include: { _count: { select: { users: true } } } },
            kpis: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        }),
        prisma.user.findMany({
          where: { departmentId: deptId, isActive: true },
          select: { id: true, name: true, email: true, role: true },
        }),
      ]);

      if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const userIds = deptUsers.map((u) => u.id);

      // Aggregate log stats at the DATABASE level instead of pulling every row
      const [statusGroups, recentLogs] = await Promise.all([
        prisma.dailyLog.groupBy({
          by: ["userId", "status"],
          where: { userId: { in: userIds }, createdAt: { gte: day30ago } },
          _count: { id: true },
          _sum: { timeSpent: true },
        }),
        prisma.dailyLog.findMany({
          where: { user: { departmentId: deptId }, createdAt: { gte: day30ago } },
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true, taskTitle: true, status: true, createdAt: true,
            user: { select: { name: true } },
          },
        }),
      ]);

      // Also need "this week" counts per user for weekLogs — one more lightweight groupBy
      const weekGroups = await prisma.dailyLog.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, createdAt: { gte: day7ago } },
        _count: { id: true },
      });
      const weekMap: Record<string, number> = {};
      for (const g of weekGroups) weekMap[g.userId] = g._count.id;

      // Build per-user stats from the grouped data (tiny in-memory work now)
      const perUser: Record<string, { total: number; approved: number; hours: number }> = {};
      for (const g of statusGroups) {
        if (!perUser[g.userId]) perUser[g.userId] = { total: 0, approved: 0, hours: 0 };
        perUser[g.userId].total += g._count.id;
        if (g.status === "APPROVED") perUser[g.userId].approved += g._count.id;
        perUser[g.userId].hours += g._sum.timeSpent || 0;
      }

      const staffStats = deptUsers.map((u) => {
        const s = perUser[u.id] || { total: 0, approved: 0, hours: 0 };
        const rate = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
        return {
          id: u.id, name: u.name, email: u.email, role: u.role,
          totalLogs: s.total, approved: s.approved,
          hours: Math.round(s.hours * 10) / 10,
          approvalRate: rate,
          weekLogs: weekMap[u.id] || 0,
        };
      }).sort((a, b) => b.totalLogs - a.totalLogs);

      // Department-level totals from the same grouped data
      let total = 0, approved = 0, rejected = 0, pending = 0, hours = 0;
      for (const g of statusGroups) {
        total += g._count.id;
        hours += g._sum.timeSpent || 0;
        if (g.status === "APPROVED") approved += g._count.id;
        else if (g.status === "REJECTED") rejected += g._count.id;
        else if (g.status === "SUBMITTED") pending += g._count.id;
      }
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

      return NextResponse.json({
        detail: {
          id: dept.id, name: dept.name, shortCode: dept.shortCode,
          category: dept.category, description: dept.description,
          units: dept.units,
          kpis: dept.kpis,
          stats: { total, approved, rejected, pending, rate, hours: Math.round(hours * 10) / 10, staff: deptUsers.length },
          staffStats,
          recentLogs,
        },
      });
    }

    // ── List view - all departments with real scores ──────────────────
    const [departments, allActiveUsers] = await Promise.all([
      prisma.department.findMany({
        include: { _count: { select: { users: true } }, units: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, departmentId: true },
      }),
    ]);

    const userIds = allActiveUsers.map((u) => u.id);
    const userDeptMap: Record<string, string | null> = {};
    for (const u of allActiveUsers) userDeptMap[u.id] = u.departmentId;

    // One aggregated query for ALL departments' logs at once, instead of per-row pulls
    const statusGroups = await prisma.dailyLog.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: userIds }, createdAt: { gte: day30ago } },
      _count: { id: true },
      _sum: { timeSpent: true },
    });

    const deptAgg: Record<string, { total: number; approved: number; hours: number }> = {};
    for (const g of statusGroups) {
      const dId = userDeptMap[g.userId];
      if (!dId) continue;
      if (!deptAgg[dId]) deptAgg[dId] = { total: 0, approved: 0, hours: 0 };
      deptAgg[dId].total += g._count.id;
      deptAgg[dId].hours += g._sum.timeSpent || 0;
      if (g.status === "APPROVED") deptAgg[dId].approved += g._count.id;
    }

    const enriched = departments.map((dept) => {
      const s = deptAgg[dept.id] || { total: 0, approved: 0, hours: 0 };
      const rate = s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
      return {
        id:          dept.id,
        name:        dept.name,
        shortCode:   dept.shortCode,
        category:    dept.category,
        description: dept.description,
        unitCount:   dept.units.length,
        _count:      dept._count,
        totalLogs:   s.total,
        approvedLogs: s.approved,
        approvalRate: rate,
        totalHours:  Math.round(s.hours * 10) / 10,
        status:      rate >= 80 ? "ON_TRACK" : rate >= 60 ? "AT_RISK" : s.total === 0 ? "NO_DATA" : "BEHIND",
      };
    });

    enriched.sort((a, b) => {
      if (a.status === "NO_DATA" && b.status !== "NO_DATA") return 1;
      if (b.status === "NO_DATA" && a.status !== "NO_DATA") return -1;
      return b.approvalRate - a.approvalRate;
    });

    return NextResponse.json(
      { departments: enriched },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[Departments API]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}