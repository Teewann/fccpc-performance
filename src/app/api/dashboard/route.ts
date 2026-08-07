import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── date helpers ─────────────────────────────────────────────────────
function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── GET /api/dashboard?filter=today|week|month|year|custom&from=&to= ─
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const filter    = searchParams.get("filter") || "week";
    const fromParam = searchParams.get("from");
    const toParam   = searchParams.get("to");

    const now = new Date();

    // ── Resolve date range ────────────────────────────────────────────
    let rangeStart: Date;
    let rangeEnd: Date;

    if (filter === "today") {
      rangeStart = startOfDay(now);
      rangeEnd   = endOfDay(now);
    } else if (filter === "week") {
      const dow  = now.getDay(); // 0=Sun
      const diff = dow === 0 ? 6 : dow - 1;
      rangeStart = startOfDay(addDays(now, -diff));
      rangeEnd   = endOfDay(now);
    } else if (filter === "month") {
      rangeStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      rangeEnd   = endOfDay(now);
    } else if (filter === "year") {
      rangeStart = startOfDay(new Date(now.getFullYear(), 0, 1));
      rangeEnd   = endOfDay(now);
    } else if (filter === "custom" && fromParam && toParam) {
      rangeStart = startOfDay(new Date(fromParam));
      rangeEnd   = endOfDay(new Date(toParam));
    } else {
      rangeStart = startOfDay(addDays(now, -6));
      rangeEnd   = endOfDay(now);
    }

    const logWhere   = { date:      { gte: rangeStart, lte: rangeEnd } };
    const taskWhere  = { createdAt: { gte: rangeStart, lte: rangeEnd } };
    const leaveWhere = { createdAt: { gte: rangeStart, lte: rangeEnd } };

    // ── KPI cards ─────────────────────────────────────────────────────
    const [
      totalStaff,
      activeDepartments,
      logsInRange,
      approvedLogs,
      rejectedLogs,
      pendingLogs,      // all-time submitted, not range-specific
      queriedLogs,
      tasksInRange,
      tasksPending,
      tasksCompleted,
      leaveInRange,
      leavePending,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.dailyLog.count({ where: logWhere }),
      prisma.dailyLog.count({ where: { ...logWhere, status: "APPROVED" } }),
      prisma.dailyLog.count({ where: { ...logWhere, status: "REJECTED" } }),
      prisma.dailyLog.count({ where: { status: "SUBMITTED" } }),
      prisma.dailyLog.count({ where: { ...logWhere, status: "QUERIED" } }),
      prisma.task.count({ where: taskWhere }),
      prisma.task.count({ where: { status: "PENDING" } }),
      prisma.task.count({ where: { ...taskWhere, status: "COMPLETED" } }),
      prisma.leaveRequest.count({ where: leaveWhere }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    ]);

    const submittedInRange = Math.max(
      0,
      logsInRange - approvedLogs - rejectedLogs - queriedLogs,
    );

    // ── Fetch all logs in range for trend grouping ────────────────────
    const allLogs = await prisma.dailyLog.findMany({
      where: logWhere,
      select: { date: true, status: true },
    });

    // ── Build trend data ──────────────────────────────────────────────
    type TrendBucket = { submitted: number; approved: number; rejected: number };
    type TrendPoint  = TrendBucket & { label: string };

    function emptyBucket(): TrendBucket {
      return { submitted: 0, approved: 0, rejected: 0 };
    }

    function classifyLog(status: string, bucket: TrendBucket) {
      if (status === "APPROVED") bucket.approved++;
      else if (status === "REJECTED") bucket.rejected++;
      else bucket.submitted++;
    }

    let trendData: TrendPoint[] = [];

    if (filter === "today") {
      // hourly buckets 00–current hour
      const hours: Record<number, TrendBucket> = {};
      for (let h = 0; h <= now.getHours(); h++) hours[h] = emptyBucket();
      for (const log of allLogs) {
        const h = new Date(log.date).getHours();
        if (hours[h]) classifyLog(log.status, hours[h]);
      }
      trendData = Object.entries(hours).map(([h, v]) => ({
        label: `${String(h).padStart(2, "0")}:00`,
        ...v,
      }));

    } else if (filter === "week") {
      // daily buckets Mon–today
      const buckets: Record<string, TrendBucket> = {};
      for (let i = 0; i < 7; i++) {
        const d = addDays(rangeStart, i);
        if (d <= now) buckets[isoDate(d)] = emptyBucket();
      }
      for (const log of allLogs) {
        const key = isoDate(new Date(log.date));
        if (buckets[key]) classifyLog(log.status, buckets[key]);
      }
      trendData = Object.entries(buckets).map(([dateStr, v]) => ({
        label: new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
        ...v,
      }));

    } else if (filter === "month") {
      // daily buckets 1st–today
      const buckets: Record<string, TrendBucket> = {};
      const cursor = new Date(rangeStart);
      while (cursor <= now) {
        buckets[isoDate(cursor)] = emptyBucket();
        cursor.setDate(cursor.getDate() + 1);
      }
      for (const log of allLogs) {
        const key = isoDate(new Date(log.date));
        if (buckets[key]) classifyLog(log.status, buckets[key]);
      }
      trendData = Object.entries(buckets).map(([dateStr, v]) => ({
        label: new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        ...v,
      }));

    } else if (filter === "year") {
      // monthly buckets Jan–current month
      const buckets: Record<string, TrendBucket> = {};
      for (let m = 0; m <= now.getMonth(); m++) {
        const key = `${now.getFullYear()}-${String(m + 1).padStart(2, "0")}`;
        buckets[key] = emptyBucket();
      }
      for (const log of allLogs) {
        const d2  = new Date(log.date);
        const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`;
        if (buckets[key]) classifyLog(log.status, buckets[key]);
      }
      trendData = Object.entries(buckets).map(([key, v]) => {
        const [yr, mo] = key.split("-");
        return {
          label: new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
          ...v,
        };
      });

    } else {
      // custom — weekly buckets
      const buckets: Record<string, TrendBucket> = {};
      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        buckets[isoDate(cursor)] = emptyBucket();
        cursor.setDate(cursor.getDate() + 7);
      }
      const bucketKeys = Object.keys(buckets).sort();
      for (const log of allLogs) {
        const logDate = new Date(log.date);
        let bucket    = bucketKeys[0];
        for (const bk of bucketKeys) {
          if (new Date(bk) <= logDate) bucket = bk;
        }
        if (bucket && buckets[bucket]) classifyLog(log.status, buckets[bucket]);
      }
      trendData = Object.entries(buckets).map(([dateStr, v]) => {
        const start = new Date(dateStr);
        const end   = addDays(start, 6);
        return {
          label: `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          ...v,
        };
      });
    }

    // ── Department bar chart ──────────────────────────────────────────
    const deptLogsRaw = await prisma.dailyLog.findMany({
      where: logWhere,
      select: { userId: true, status: true },
    });

    const userIds = [...new Set(deptLogsRaw.map((l) => l.userId))];
    const usersWithDept = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, department: { select: { name: true } } },
    });
    const userDeptMap: Record<string, string> = {};
    for (const u of usersWithDept) {
      userDeptMap[u.id] = u.department?.name || "Unassigned";
    }

    const deptAgg: Record<string, { total: number; approved: number }> = {};
    for (const log of deptLogsRaw) {
      const name = userDeptMap[log.userId] || "Unassigned";
      if (!deptAgg[name]) deptAgg[name] = { total: 0, approved: 0 };
      deptAgg[name].total++;
      if (log.status === "APPROVED") deptAgg[name].approved++;
    }

    const departmentChart = Object.entries(deptAgg)
      .map(([name, v]) => ({
        name:     name.length > 18 ? name.slice(0, 18) + "…" : name,
        logs:     v.total,
        approved: v.approved,
      }))
      .sort((a, b) => b.logs - a.logs)
      .slice(0, 8);

    // ── Pie data ──────────────────────────────────────────────────────
    const pieData = [
      { name: "Approved",  value: approvedLogs,     fill: "#22c55e" },
      { name: "Pending",   value: submittedInRange,  fill: "#f59e0b" },
      { name: "Rejected",  value: rejectedLogs,      fill: "#ef4444" },
      { name: "Queried",   value: queriedLogs,        fill: "#3b82f6" },
    ];

    // ── Top performers ────────────────────────────────────────────────
    const topRaw = await prisma.dailyLog.groupBy({
      by:       ["userId"],
      where:    { ...logWhere, status: "APPROVED" },
      _count:   { id: true },
      orderBy:  { _count: { id: "desc" } },
      take:     5,
    });

    const topUserDetails = await prisma.user.findMany({
      where:  { id: { in: topRaw.map((t) => t.userId) } },
      select: { id: true, name: true, staffId: true, department: { select: { name: true } } },
    });

    const performers = topRaw.map((t) => {
      const u = topUserDetails.find((x) => x.id === t.userId);
      return {
        name:       u?.name       || "Unknown",
        department: u?.department?.name || "—",
        staffId:    u?.staffId    || null,
        count:      t._count.id,
      };
    });

    // ── Recent logs ───────────────────────────────────────────────────
    const recentLogs = await prisma.dailyLog.findMany({
      take:    8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, taskTitle: true, status: true, date: true,
        user: { select: { name: true, department: { select: { name: true } } } },
      },
    });

    // ── Low activity departments ──────────────────────────────────────
    const allDepts = await prisma.department.findMany({
      select: { id: true, name: true, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });

    const activeDeptSet = new Set(
      Object.keys(deptAgg).map((n) =>
        n.endsWith("…") ? n.slice(0, -1) : n
      )
    );

    const lowActivity = allDepts
      .filter((d) => {
        const truncated = d.name.length > 18 ? d.name.slice(0, 18) : d.name;
        return !activeDeptSet.has(d.name) && !activeDeptSet.has(truncated);
      })
      .slice(0, 5)
      .map((d) => ({ name: d.name, staff: d._count.users }));

    // ── Tasks by status for task pie ──────────────────────────────────
    const [taskInProgress, taskOverdue] = await Promise.all([
      prisma.task.count({ where: { ...taskWhere, status: "IN_PROGRESS" } }),
      prisma.task.count({ where: { ...taskWhere, status: "OVERDUE" } }),
    ]);

    return NextResponse.json({
      kpi: {
        totalStaff,
        activeDepartments,
        logsInRange,
        approvedLogs,
        rejectedLogs,
        pendingLogs,
        queriedLogs,
        submittedInRange,
        tasksInRange,
        tasksPending,
        tasksCompleted,
        leaveInRange,
        leavePending,
      },
      trendData,
      departmentChart,
      pieData,
      performers,
      recentLogs,
      lowActivity,
      taskBreakdown: [
        { name: "Pending",     value: tasksPending,   fill: "#f59e0b" },
        { name: "In Progress", value: taskInProgress,  fill: "#3b82f6" },
        { name: "Completed",   value: tasksCompleted,  fill: "#22c55e" },
        { name: "Overdue",     value: taskOverdue,     fill: "#ef4444" },
      ],
    });
  } catch (error) {
    console.error("[Dashboard API]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
