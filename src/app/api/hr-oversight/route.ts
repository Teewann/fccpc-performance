// src/app/api/hr-oversight/route.ts
//
// Org-wide oversight for HR/Admin/Executive
// OPTIMIZED: Reduced database queries, added proper indexes, limited data scope

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const OVERSIGHT_ROLES = ["HR", "ADMIN", "EXECUTIVE"];
const STALE_DAYS = 7;
const MIN_SAMPLE_FOR_ANOMALY = 5;
const DEVIATION_THRESHOLD = 20;
const MAX_LOGS_TO_FETCH = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const user = await prisma.user.findUnique({ 
      where: { email: session.user.email },
      select: { role: true }
    });
    
    if (!user || !OVERSIGHT_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "This view is for HR, Admin, and Executive" }, { status: 403 });
    }

    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    const anomalyWindowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // ✅ Run queries in parallel with limits
    const [disputedLogs, stalePending, scoringData, orgAvgResult] = await Promise.all([
      // 1. Disputed logs - limited to 50 most recent
      prisma.dailyLog.findMany({
        where: { ackStatus: "DISPUTED" },
        select: {
          id: true,
          taskTitle: true,
          description: true,
          createdAt: true,
          refNo: true,
          user: { select: { id: true, name: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_LOGS_TO_FETCH,
      }),
      
      // 2. Stale pending logs - limited to 50 oldest
      prisma.dailyLog.findMany({
        where: { 
          ackStatus: "PENDING", 
          createdAt: { lt: staleCutoff } 
        },
        select: {
          id: true,
          taskTitle: true,
          description: true,
          createdAt: true,
          refNo: true,
          user: { select: { id: true, name: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
        take: MAX_LOGS_TO_FETCH,
      }),
      
      // 3. Scoring data - ✅ USING AWAIT WITH $queryRaw
      prisma.$queryRaw<{ supervisorId: string; count: number; avgScore: number }[]>`
        SELECT 
          "supervisorId",
          COUNT(*) as count,
          AVG("supervisorScore") as avgScore
        FROM "DailyLog"
        WHERE 
          status = 'APPROVED' 
          AND "supervisorScore" IS NOT NULL 
          AND "reviewedAt" >= ${anomalyWindowStart}
        GROUP BY "supervisorId"
        HAVING COUNT(*) >= ${MIN_SAMPLE_FOR_ANOMALY}
      `,
      
      // 4. Org average - ✅ USING AWAIT WITH $queryRaw
      prisma.$queryRaw<{ avg: number | null }[]>`
        SELECT AVG("supervisorScore") as avg
        FROM "DailyLog"
        WHERE 
          status = 'APPROVED' 
          AND "supervisorScore" IS NOT NULL 
          AND "reviewedAt" >= ${anomalyWindowStart}
      `,
    ]);

    // ✅ orgAvgResult is now the actual data array, not a Promise
    const orgAverage = orgAvgResult.length > 0 ? orgAvgResult[0].avg : null;

    // Filter scoring anomalies
    const scoringAnomalies = scoringData
      .filter((s) => s.avgScore !== null && orgAverage !== null && Math.abs(s.avgScore - orgAverage) >= DEVIATION_THRESHOLD)
      .map((s) => ({
        supervisorId: s.supervisorId,
        avgScoreGiven: Math.round(s.avgScore * 10) / 10,
        sampleSize: s.count,
        orgAverage: orgAverage !== null ? Math.round(orgAverage * 10) / 10 : null,
        direction: orgAverage !== null && s.avgScore > orgAverage ? "above" : "below",
        name: null,
        department: null,
      }));

    // Only fetch supervisor details if there are anomalies
    let supervisorDetails: { id: string; name: string; department: { name: string } | null }[] = [];
    if (scoringAnomalies.length > 0) {
      supervisorDetails = await prisma.user.findMany({
        where: { id: { in: scoringAnomalies.map((s) => s.supervisorId) } },
        select: { 
          id: true, 
          name: true, 
          department: { select: { name: true } } 
        },
      });
    }

    // Map supervisor names
    const anomaliesWithNames = scoringAnomalies.map((anomaly) => {
      const detail = supervisorDetails.find((d) => d.id === anomaly.supervisorId);
      return {
        ...anomaly,
        name: detail?.name || "Unknown",
        department: detail?.department?.name || null,
      };
    });

    return NextResponse.json({
      disputedLogs,
      stalePending,
      scoringAnomalies: anomaliesWithNames,
      orgAverage: orgAverage !== null ? Math.round(orgAverage * 10) / 10 : null,
    });
  } catch (error) {
    console.error("HR oversight GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const hrUser = await prisma.user.findUnique({ 
      where: { email: session.user.email },
      select: { id: true, role: true }
    });
    
    if (!hrUser || !OVERSIGHT_ROLES.includes(hrUser.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { logId, action, note } = body;

    const log = await prisma.dailyLog.findUnique({
      where: { id: logId },
      select: {
        id: true,
        taskTitle: true,
        refNo: true,
        userId: true,
        loggedByProxy: true,
        proxyLoggedById: true,
      },
    });
    
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    if (action === "resolve") {
      await prisma.$transaction([
        prisma.dailyLog.update({
          where: { id: logId },
          data: {
            ackStatus: "CONFIRMED",
            hrResolutionNote: note || null,
            hrResolvedById: hrUser.id,
            hrResolvedAt: new Date(),
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: hrUser.id,
            action: "HR_DISPUTE_RESOLVED",
            detail: `Resolved dispute on log "${log.taskTitle}" (${log.refNo || log.id})${note ? ` — ${note}` : ""}`,
          },
        }),
      ]);
      return NextResponse.json({ success: true });
    }

    if (action === "remind") {
      const notifyId = log.loggedByProxy && log.proxyLoggedById ? log.proxyLoggedById : log.userId;
      
      await prisma.notification.create({
        data: {
          userId: notifyId,
          title: "Reminder: confirmation needed",
          message: `HR is reminding you that "${log.taskTitle}" is still waiting on your confirmation.`,
          type: "WARNING",
          link: "/daily-log",
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("HR oversight POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}