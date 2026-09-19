// src/app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const SEGMENTS: Record<string, string[]> = {
  FRONTLINE: ["STAFF", "INTERN", "CORPER", "CONTRACT", "CONSULTANT", "IT_SIWES", "OTHER"],
  SUPERVISORY: ["SUPERVISOR"],
  LEADERSHIP: ["DIRECTOR", "HR", "ADMIN", "EXECUTIVE", "CHIEF"],
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "month";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date = new Date(now); rangeEnd.setHours(23, 59, 59, 999);

    if (filter === "today") {
      rangeStart = new Date(now); rangeStart.setHours(0, 0, 0, 0);
    } else if (filter === "week") {
      rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate() - 7); rangeStart.setHours(0, 0, 0, 0);
    } else if (filter === "year") {
      rangeStart = new Date(now.getFullYear(), 0, 1);
    } else if (filter === "custom" && from && to) {
      rangeStart = new Date(from); rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = new Date(to);     rangeEnd.setHours(23, 59, 59, 999);
    } else {
      rangeStart = new Date(now); rangeStart.setDate(1); rangeStart.setHours(0, 0, 0, 0);
    }

    const label =
      filter === "today" ? "Today" :
      filter === "week"  ? "Last 7 days" :
      filter === "year"  ? String(rangeStart.getFullYear()) :
      filter === "custom" ? `${rangeStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${rangeEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` :
      rangeStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    // ── All active users (so nobody is missed) ─────────────────────
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        jobTitle: true,
        department: { select: { name: true } },
      },
    });

    // ── Logs in range ──────────────────────────────────────────────
    const logs = await prisma.dailyLog.findMany({
      where: {
        createdAt: { gte: rangeStart, lte: rangeEnd },
        status: { in: ["SUBMITTED", "APPROVED"] },
        OR: [{ ackStatus: null }, { ackStatus: { not: "DISPUTED" } }],
      },
      select: { userId: true, supervisorScore: true, status: true, createdAt: true },
    });

    const byUser: Record<string, {
      count: number;
      approved: number;
      scoreSum: number;
      scoreCount: number;
      days: Set<string>;
    }> = {};
    for (const log of logs) {
      if (!byUser[log.userId]) {
        byUser[log.userId] = { count: 0, approved: 0, scoreSum: 0, scoreCount: 0, days: new Set() };
      }
      byUser[log.userId].count++;
      if (log.status === "APPROVED") byUser[log.userId].approved++;
      if (log.supervisorScore != null) {
        byUser[log.userId].scoreSum += log.supervisorScore;
        byUser[log.userId].scoreCount++;
      }
      byUser[log.userId].days.add(new Date(log.createdAt).toDateString());
    }

    // ── Task aggregates in same range ──────────────────────────────
    const completedGroups = await prisma.task.groupBy({
      by: ["assignedToId"],
      where: {
        status: "COMPLETED",
        completedAt: { gte: rangeStart, lte: rangeEnd },
        assignedToId: { not: null },
      },
      _count: { id: true },
    });
    const completedMap: Record<string, number> = {};
    for (const g of completedGroups) {
      if (g.assignedToId) completedMap[g.assignedToId] = g._count.id;
    }

    const overdueGroups = await prisma.task.groupBy({
      by: ["assignedToId"],
      where: {
        assignedToId: { not: null },
        dueDate: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      _count: { id: true },
    });
    const overdueMap: Record<string, number> = {};
    for (const g of overdueGroups) {
      if (g.assignedToId) overdueMap[g.assignedToId] = g._count.id;
    }

    // ── Rank everyone (including 0) ────────────────────────────────
    const ranked = users.map((u) => {
      const stats = byUser[u.id] || { count: 0, approved: 0, scoreSum: 0, scoreCount: 0, days: new Set<string>() };
      const avgScore = stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null;
      const completedTasks = completedMap[u.id] || 0;
      const overdueTasks   = overdueMap[u.id]   || 0;

      const logPoints        = stats.approved * 3;
      const taskPoints       = completedTasks * 3;
      const hasApprovedWork  = stats.approved > 0 || completedTasks > 0;
      const qualityBonus     = hasApprovedWork && avgScore !== null ? (avgScore / 100) * 15 : 0;
      const consistencyBonus = hasApprovedWork ? Math.min(stats.days.size * 1.25, 10) : 0;
      const overdueePenalty  = Math.min(overdueTasks * 2, 20);

      const rawScore = logPoints + taskPoints + qualityBonus + consistencyBonus - overdueePenalty;
      const performanceIndex = Math.max(0, Math.min(Math.round(rawScore), 100));

      let segment = "FRONTLINE";
      for (const [seg, roles] of Object.entries(SEGMENTS)) {
        if (roles.includes(u.role)) { segment = seg; break; }
      }

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        jobTitle: u.jobTitle,
        department: u.department?.name || null,
        taskCount: stats.count,
        approvedCount: stats.approved,
        completedTasks,
        overdueTasks,
        avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
        performanceIndex,
        segment,
      };
    });

    // ── Segment + sort + rank (everyone, no filter) ────────────────
    const bySegment: Record<string, typeof ranked> = { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] };
    for (const r of ranked) bySegment[r.segment].push(r);
    for (const seg of Object.keys(bySegment)) {
      bySegment[seg] = bySegment[seg]
        .sort((a, b) => b.performanceIndex - a.performanceIndex)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    }

    return NextResponse.json({
      segments: bySegment,
      monthLabel: label,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}