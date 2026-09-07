// src/app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── CACHE ──────────────────────────────────────────────────────────────
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds - enough to reduce load, not enough to be stale

// ─── GET /api/dashboard ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "week";
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // ✅ Check cache FIRST
    if (filter === "week" && cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log(`✅ Dashboard cache hit (${Date.now() - startTime}ms)`);
      return NextResponse.json(cache.data);
    }

    const now = new Date();

    // ── Resolve date range ────────────────────────────────────────────
    let rangeStart: Date;
    let rangeEnd: Date;

    if (filter === "today") {
      rangeStart = new Date(now); rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(now); rangeEnd.setHours(23, 59, 59, 999);
    } else if (filter === "week") {
      rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 7);
      rangeEnd = new Date(now);
    } else if (filter === "month") {
      rangeStart = new Date(now); rangeStart.setMonth(now.getMonth() - 1);
      rangeEnd = new Date(now);
    } else if (filter === "year") {
      rangeStart = new Date(now); rangeStart.setFullYear(now.getFullYear() - 1);
      rangeEnd = new Date(now);
    } else if (filter === "custom" && fromParam && toParam) {
      rangeStart = new Date(fromParam);
      rangeEnd = new Date(toParam);
    } else {
      rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 7);
      rangeEnd = new Date(now);
    }

    // ─── ALL QUERIES IN PARALLEL (ONE BATCH) ─────────────────────────
    const [
      // KPI counts
      totalStaff,
      activeDepartments,
      logsInRange,
      approvedLogs,
      rejectedLogs,
      pendingLogs,
      queriedLogs,
      tasksInRange,
      tasksPending,
      tasksCompleted,
      leaveInRange,
      leavePending,
      
      // Aggregated data (using raw SQL for speed)
      trendData,
      deptChartData,
      performerData,
      lowActivityData,
      
      // Recent logs
      recentLogs,
    ] = await Promise.all([
      // ── KPI counts ──
      prisma.user.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.dailyLog.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd } } }),
      prisma.dailyLog.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd }, status: "APPROVED" } }),
      prisma.dailyLog.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd }, status: "REJECTED" } }),
      prisma.dailyLog.count({ where: { status: "SUBMITTED" } }),
      prisma.dailyLog.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd }, status: "QUERIED" } }),
      prisma.task.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd } } }),
      prisma.task.count({ where: { status: "PENDING" } }),
      prisma.task.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd }, status: "COMPLETED" } }),
      prisma.leaveRequest.count({ where: { createdAt: { gte: rangeStart, lte: rangeEnd } } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      
      // ── Trend data (SQL - fast) ──
      prisma.$queryRaw<{ date: Date; count: number; approved: number; rejected: number }[]>`
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
        FROM "DailyLog"
        WHERE "createdAt" >= ${rangeStart} AND "createdAt" <= ${rangeEnd}
        GROUP BY DATE("createdAt")
        ORDER BY DATE("createdAt") DESC
        LIMIT 30
      `,
      
      // ── Department chart (SQL - fast) ──
      prisma.$queryRaw<{ name: string; logs: number; approved: number }[]>`
        SELECT 
          d.name,
          COUNT(l.id) as logs,
          COUNT(CASE WHEN l.status = 'APPROVED' THEN 1 END) as approved
        FROM "Department" d
        LEFT JOIN "User" u ON u."departmentId" = d.id
        LEFT JOIN "DailyLog" l ON l."userId" = u.id 
          AND l."createdAt" >= ${rangeStart} AND l."createdAt" <= ${rangeEnd}
        GROUP BY d.id, d.name
        ORDER BY logs DESC
        LIMIT 10
      `,
      
      // ── Top performers (SQL - fast) ──
      prisma.$queryRaw<{ name: string; department: string; count: number }[]>`
        SELECT 
          u.name,
          COALESCE(d.name, 'Unknown') as department,
          COUNT(l.id) as count
        FROM "DailyLog" l
        JOIN "User" u ON u.id = l."userId"
        LEFT JOIN "Department" d ON d.id = u."departmentId"
        WHERE l.status = 'APPROVED' 
          AND l."createdAt" >= ${rangeStart} AND l."createdAt" <= ${rangeEnd}
        GROUP BY u.id, u.name, d.name
        ORDER BY count DESC
        LIMIT 5
      `,
      
      // ── Low activity (SQL - fast) ──
      prisma.$queryRaw<{ name: string; staff: number }[]>`
        SELECT 
          d.name,
          COUNT(u.id) as staff
        FROM "Department" d
        JOIN "User" u ON u."departmentId" = d.id AND u."isActive" = true
        LEFT JOIN "DailyLog" l ON l."userId" = u.id 
          AND l."createdAt" >= ${rangeStart} AND l."createdAt" <= ${rangeEnd}
        GROUP BY d.id, d.name
        HAVING COUNT(l.id) = 0
        LIMIT 5
      `,
      
      // ── Recent logs ──
      prisma.dailyLog.findMany({
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          taskTitle: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              department: { select: { name: true } }
            }
          }
        }
      }),
    ]);

    // ─── Build response ──────────────────────────────────────────────
    const submittedInRange = Math.max(0, logsInRange - approvedLogs - rejectedLogs - queriedLogs);

    // Format trend data
    const formattedTrendData = (trendData as any[]).map((d) => ({
      label: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      submitted: Number(d.count) - Number(d.approved) - Number(d.rejected),
      approved: Number(d.approved),
      rejected: Number(d.rejected),
    }));

    // Format department chart
    const formattedDeptChart = (deptChartData as any[]).map((d) => ({
      name: d.name.length > 18 ? d.name.slice(0, 18) + "…" : d.name,
      logs: Number(d.logs),
      approved: Number(d.approved),
    }));

    // Format performers
    const formattedPerformers = (performerData as any[]).map((p) => ({
      name: p.name || "Unknown",
      department: p.department || "—",
      staffId: null,
      count: Number(p.count),
    }));

    // Format low activity
    const formattedLowActivity = (lowActivityData as any[]).map((d) => ({
      name: d.name,
      staff: Number(d.staff),
    }));

    // ─── Task breakdown ──────────────────────────────────────────────
    const taskBreakdown = [
      { name: "Pending", value: tasksPending, fill: "#f59e0b" },
      { name: "Completed", value: tasksCompleted, fill: "#22c55e" },
    ];
    
    const otherTasks = Math.max(0, tasksInRange - tasksPending - tasksCompleted);
    if (otherTasks > 0) {
      taskBreakdown.push({ name: "Other", value: otherTasks, fill: "#94a3b8" });
    }

    // ─── Result ──────────────────────────────────────────────────────
    const result = {
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
      trendData: formattedTrendData,
      departmentChart: formattedDeptChart,
      pieData: [
        { name: "Approved", value: approvedLogs, fill: "#22c55e" },
        { name: "Pending", value: submittedInRange, fill: "#f59e0b" },
        { name: "Rejected", value: rejectedLogs, fill: "#ef4444" },
        { name: "Queried", value: queriedLogs, fill: "#3b82f6" },
      ].filter((p) => p.value > 0),
      performers: formattedPerformers,
      recentLogs: recentLogs.map((log) => ({
        ...log,
        date: log.createdAt,
        user: {
          ...log.user,
          department: log.user.department || { name: "Unknown" }
        }
      })),
      lowActivity: formattedLowActivity,
      taskBreakdown,
    };

    // ─── Cache ──────────────────────────────────────────────────────
    if (filter === "week") {
      cache = { data: result, timestamp: Date.now() };
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Dashboard loaded in ${elapsed}ms (filter: ${filter})`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Dashboard API] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}