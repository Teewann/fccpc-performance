// src/app/api/hr-oversight/route.ts
//
// Org-wide oversight for HR/Admin/Executive — the piece that answers your
// original concern directly: what if a supervisor scores someone unfairly
// because of a personal issue? This surfaces supervisors whose average
// score deviates significantly from the org average, rather than relying
// on the affected staff member to notice and complain.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const OVERSIGHT_ROLES = ["HR", "ADMIN", "EXECUTIVE"];
const STALE_DAYS = 3;
const MIN_SAMPLE_FOR_ANOMALY = 3; // don't flag a supervisor off one or two scores
const DEVIATION_THRESHOLD = 15; // points away from org average, on the 0-100 scale

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || !OVERSIGHT_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "This view is for HR, Admin, and Executive" }, { status: 403 });
    }

    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    const anomalyWindowStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // last 60 days, reasonable sample

    const [disputedLogs, stalePending, scoredLogs] = await Promise.all([
      prisma.dailyLog.findMany({
        where: { ackStatus: "DISPUTED" },
        include: {
          user: { select: { id: true, name: true, department: { select: { name: true } } } },
          proxyLoggedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.dailyLog.findMany({
        where: { ackStatus: "PENDING", createdAt: { lt: staleCutoff } },
        include: {
          user: { select: { id: true, name: true, department: { select: { name: true } } } },
          proxyLoggedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      // Bounded to a 60-day window and only the two fields needed — not a
      // full-table scan of every log ever scored.
      prisma.dailyLog.findMany({
        where: { status: "APPROVED", supervisorScore: { not: null }, reviewedAt: { gte: anomalyWindowStart } },
        select: { supervisorId: true, supervisorScore: true },
      }),
    ]);

    // Compute org-wide average and per-supervisor averages from the same
    // dataset in memory — cheap at this volume, avoids N+1 queries.
    const orgTotal = scoredLogs.reduce((sum, l) => sum + (l.supervisorScore || 0), 0);
    const orgAvg = scoredLogs.length > 0 ? orgTotal / scoredLogs.length : null;

    const bySupervisor: Record<string, { sum: number; count: number }> = {};
    for (const l of scoredLogs) {
      if (!l.supervisorId) continue;
      if (!bySupervisor[l.supervisorId]) bySupervisor[l.supervisorId] = { sum: 0, count: 0 };
      bySupervisor[l.supervisorId].sum += l.supervisorScore || 0;
      bySupervisor[l.supervisorId].count++;
    }

    const flaggedSupervisorIds = Object.entries(bySupervisor)
      .filter(([, stats]) => stats.count >= MIN_SAMPLE_FOR_ANOMALY)
      .map(([id, stats]) => ({ id, avg: stats.sum / stats.count, count: stats.count }))
      .filter((s) => orgAvg != null && Math.abs(s.avg - orgAvg) >= DEVIATION_THRESHOLD);

    const supervisorDetails = flaggedSupervisorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: flaggedSupervisorIds.map((s) => s.id) } },
          select: { id: true, name: true, role: true, department: { select: { name: true } } },
        })
      : [];

    const scoringAnomalies = flaggedSupervisorIds.map((f) => {
      const detail = supervisorDetails.find((d) => d.id === f.id);
      return {
        supervisorId: f.id,
        name: detail?.name || "Unknown",
        department: detail?.department?.name || null,
        avgScoreGiven: Math.round(f.avg * 10) / 10,
        orgAverage: orgAvg != null ? Math.round(orgAvg * 10) / 10 : null,
        sampleSize: f.count,
        direction: orgAvg != null && f.avg > orgAvg ? "above" : "below",
      };
    });

    return NextResponse.json({
      disputedLogs,
      stalePending,
      scoringAnomalies,
      orgAverage: orgAvg != null ? Math.round(orgAvg * 10) / 10 : null,
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
    const hrUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!hrUser || !OVERSIGHT_ROLES.includes(hrUser.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { logId, action, note } = body; // action: "resolve" | "remind"

    const log = await prisma.dailyLog.findUnique({
      where: { id: logId },
      include: { user: { select: { id: true, name: true } }, proxyLoggedBy: { select: { id: true, name: true } } },
    });
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    if (action === "resolve") {
      const updated = await prisma.dailyLog.update({
        where: { id: logId },
        data: {
          ackStatus: "CONFIRMED",
          hrResolutionNote: note || null,
          hrResolvedById: hrUser.id,
          hrResolvedAt: new Date(),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: hrUser.id,
          action: "HR_DISPUTE_RESOLVED",
          detail: `Resolved dispute on log "${log.taskTitle}" (${log.refNo || log.id})${note ? ` — ${note}` : ""}`,
        },
      });
      return NextResponse.json({ success: true, log: updated });
    }

    if (action === "remind") {
      // Remind whoever the acknowledgment is actually waiting on.
      const notifyId = log.loggedByProxy ? log.userId : (log.proxyLoggedBy?.id || log.userId);
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