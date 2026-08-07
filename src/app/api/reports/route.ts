import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET — returns report data (the frontend generates the actual PDF/Excel)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type   = searchParams.get("type")   || "staff-logs";
    const period = searchParams.get("period") || "monthly";
    const deptId = searchParams.get("deptId") || null;

    // Fetch the current user for the report header
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, role: true, staffId: true },
    });

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const qMonth     = Math.floor(now.getMonth() / 3) * 3;
    const qStart     = new Date(now.getFullYear(), qMonth, 1);

    const dateFrom =
      period === "weekly"    ? new Date(now.setDate(now.getDate() - 7)) :
      period === "monthly"   ? monthStart :
      period === "quarterly" ? qStart     : yearStart;

    let rows: any[] = [];

    if (type === "staff-logs") {
      const logs = await prisma.dailyLog.findMany({
        where: {
          createdAt: { gte: dateFrom },
          ...(deptId ? { user: { departmentId: deptId } } : {}),
        },
        include: {
          user: { include: { department: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      rows = logs.map((l) => ({
        staffName:   l.user.name,
        staffEmail:  l.user.email,
        department:  l.user.department?.name ?? "Unassigned",
        unit:        l.user.unit?.name ?? "",
        taskTitle:   l.taskTitle,
        taskCategory:l.taskCategory,
        description: l.description,
        timeSpent:   l.timeSpent,
        priority:    l.priority,
        status:      l.status,
        caseRef:     l.caseReference ?? "",
        supervisorScore: l.supervisorScore ?? "",
        supervisorComment: l.supervisorComment ?? "",
        date: new Date(l.createdAt).toLocaleDateString("en-GB"),
      }));
    } else if (type === "kpi-summary") {
      const kpis = await prisma.kPI.findMany({
        where: deptId ? { departmentId: deptId } : {},
        include: { department: true },
      });

      rows = kpis.map((k) => {
        const pct = k.target > 0 ? Math.round((k.current / k.target) * 100) : 0;
        return {
          department: k.department.name,
          kpiTitle:   k.title,
          target:     k.target,
          current:    k.current,
          unit:       k.unit,
          percentage: `${pct}%`,
          period:     k.period,
          status:     pct >= 90 ? "On Track" : pct >= 60 ? "At Risk" : "Behind",
          startDate:  new Date(k.startDate).toLocaleDateString("en-GB"),
          endDate:    new Date(k.endDate).toLocaleDateString("en-GB"),
        };
      });
    } else if (type === "dept-ranking") {
      const depts = await prisma.department.findMany({
        include: {
          users: {
            include: {
              dailyLogs: {
                where: { createdAt: { gte: dateFrom } },
                select: { status: true, supervisorScore: true, timeSpent: true },
              },
            },
          },
          _count: { select: { users: true } },
        },
      });

      rows = depts.map((d) => {
        const allLogs   = d.users.flatMap((u) => u.dailyLogs);
        const approved  = allLogs.filter((l) => l.status === "APPROVED").length;
        const total     = allLogs.length;
        const rate      = total > 0 ? Math.round((approved / total) * 100) : 0;
        const avgScore  = allLogs.filter((l) => l.supervisorScore).length > 0
          ? Math.round(allLogs.reduce((s, l) => s + (l.supervisorScore || 0), 0) /
              allLogs.filter((l) => l.supervisorScore).length * 10) / 10
          : 0;

        return {
          department:   d.name,
          shortCode:    d.shortCode,
          staffCount:   d._count.users,
          totalLogs:    total,
          approvedLogs: approved,
          approvalRate: `${rate}%`,
          avgQualityScore: avgScore,
          status: rate >= 80 ? "On Track" : rate >= 60 ? "At Risk" : "Behind",
        };
      }).sort((a, b) => parseInt(b.approvalRate) - parseInt(a.approvalRate));
    } else if (type === "appraisal") {
      const users = await prisma.user.findMany({
        where: { role: "STAFF" },
        include: {
          department: true,
          dailyLogs: {
            where:  { createdAt: { gte: dateFrom } },
            select: { status: true, supervisorScore: true, timeSpent: true, priority: true },
          },
        },
      });

      rows = users.map((u) => {
        const logs       = u.dailyLogs;
        const approved   = logs.filter((l) => l.status === "APPROVED").length;
        const total      = logs.length;
        const totalHours = logs.reduce((s, l) => s + l.timeSpent, 0);
        const avgScore   = logs.filter((l) => l.supervisorScore).length > 0
          ? Math.round(logs.reduce((s, l) => s + (l.supervisorScore || 0), 0) /
              logs.filter((l) => l.supervisorScore).length * 10) / 10
          : null;
        const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

        return {
          staffName:       u.name,
          staffId:         u.staffId ?? "",
          department:      u.department?.name ?? "Unassigned",
          totalLogs:       total,
          approved,
          approvalRate:    `${rate}%`,
          totalHours:      Math.round(totalHours * 10) / 10,
          avgQualityScore: avgScore ?? "N/A",
          performanceRating:
            rate >= 85 ? "Excellent" :
            rate >= 70 ? "Good"      :
            rate >= 55 ? "Satisfactory" : "Needs Improvement",
          status: rate >= 85 ? "Excellent" : rate >= 70 ? "Good" : rate >= 55 ? "Satisfactory" : "Needs Improvement", // duplicate for status coloring
        };
      });
    }

    return NextResponse.json({
      rows,
      count: rows.length,
      period,
      type,
      meta: {
        requestedBy: {
          name: user?.name || "Unknown",
          role: user?.role || "Unknown",
          staffId: user?.staffId || "",
          email: session.user.email,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
