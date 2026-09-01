// src/app/api/leaderboard/route.ts
//
// Ranks staff by a Performance Index that weights quality, not just raw
// count — count alone would just train people to log lots of trivial
// entries. Segmented by role level so a Director isn't compared against a
// junior officer. Disputed entries (from the acknowledge flow) are excluded
// entirely — a disputed claim shouldn't boost anyone's ranking.

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

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Bounded query — this month only, minimal fields, no full staff list
    // pulled unless they actually logged something.
    const logs = await prisma.dailyLog.findMany({
      where: {
        createdAt: { gte: monthStart },
        status: { in: ["SUBMITTED", "APPROVED"] },
        NOT: { ackStatus: "DISPUTED" },
      },
      select: { userId: true, supervisorScore: true },
    });

    const byUser: Record<string, { count: number; scoreSum: number; scoreCount: number }> = {};
    for (const log of logs) {
      if (!byUser[log.userId]) byUser[log.userId] = { count: 0, scoreSum: 0, scoreCount: 0 };
      byUser[log.userId].count++;
      if (log.supervisorScore != null) {
        byUser[log.userId].scoreSum += log.supervisorScore;
        byUser[log.userId].scoreCount++;
      }
    }

    const userIds = Object.keys(byUser);
    if (userIds.length === 0) {
      return NextResponse.json({
        segments: { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] },
        monthLabel: monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, name: true, role: true, jobTitle: true, department: { select: { name: true } } },
    });

    const ranked = users.map((u) => {
      const stats = byUser[u.id];
      const avgScore = stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null;
      // No score yet defaults to a neutral 0.7 multiplier rather than 0 or 1 —
      // unscored work shouldn't be punished OR fully rewarded before a
      // supervisor has actually reviewed it.
      const multiplier = avgScore != null ? avgScore / 10 : 0.7;
      const performanceIndex = Math.round(stats.count * multiplier * 10) / 10;

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
        avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
        performanceIndex,
        segment,
      };
    });

    const bySegment: Record<string, typeof ranked> = { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] };
    for (const r of ranked) bySegment[r.segment].push(r);
    for (const seg of Object.keys(bySegment)) {
      bySegment[seg] = bySegment[seg]
        .sort((a, b) => b.performanceIndex - a.performanceIndex)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    }

    return NextResponse.json({
      segments: bySegment,
      monthLabel: monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}