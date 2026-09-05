// src/app/api/incentive-recommendations/route.ts
//
// Surfaces top performers to HR/EVC leadership as a RECOMMENDATION, never
// an automatic decision — matches the governance principle from the
// original design: the system suggests recognition, humans decide reward.
// Excludes disputed entries and unscored work the same way the leaderboard
// does, so a recommendation can't be built on a fabricated or unverified claim.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const LEADERSHIP_ROLES = ["HR", "ADMIN", "EXECUTIVE"];

const SEGMENTS: Record<string, string[]> = {
  FRONTLINE: ["STAFF", "INTERN", "CORPER", "CONTRACT", "CONSULTANT", "IT_SIWES", "OTHER"],
  SUPERVISORY: ["SUPERVISOR"],
  LEADERSHIP: ["DIRECTOR", "HR", "ADMIN", "EXECUTIVE", "CHIEF"],
};

function currentMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Shared with /performance's logic conceptually, kept separate here since
// this one needs to persist results, not just return a live view.
async function computeAndStoreRecommendations(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 1);

  const logs = await prisma.dailyLog.findMany({
    where: {
      createdAt: { gte: monthStart, lt: monthEnd },
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
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, role: true },
  });

  const ranked = users.map((u) => {
    const stats = byUser[u.id];
    const avgScore = stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null;
    const multiplier = avgScore != null ? avgScore / 100 : 0.7;
    const performanceIndex = Math.round(stats.count * multiplier * 10) / 10;
    let segment = "FRONTLINE";
    for (const [seg, roles] of Object.entries(SEGMENTS)) {
      if (roles.includes(u.role)) { segment = seg; break; }
    }
    return { userId: u.id, segment, performanceIndex, taskCount: stats.count, avgScore };
  });

  const bySegment: Record<string, typeof ranked> = { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] };
  for (const r of ranked) bySegment[r.segment].push(r);

  const toRecommend: (typeof ranked) & { rank: number }[] = [] as any;
  for (const seg of Object.keys(bySegment)) {
    const sorted = bySegment[seg]
      .filter((r) => r.performanceIndex > 0)
      .sort((a, b) => b.performanceIndex - a.performanceIndex);
    const topCount = Math.max(1, Math.ceil(sorted.length * 0.1)); // top 10%, at least 1
    sorted.slice(0, topCount).forEach((r, i) => {
      toRecommend.push({ ...r, rank: i + 1 } as any);
    });
  }

  // Upsert so re-running doesn't duplicate, and preserves any existing
  // status/hrNote if HR already acted on someone this month.
  await Promise.all(
    toRecommend.map((r: any) =>
      prisma.incentiveRecommendation.upsert({
        where: { userId_month: { userId: r.userId, month } },
        update: {
          segment: r.segment,
          rank: r.rank,
          performanceIndex: r.performanceIndex,
          taskCount: r.taskCount,
          avgScore: r.avgScore,
        },
        create: {
          userId: r.userId,
          month,
          segment: r.segment,
          rank: r.rank,
          performanceIndex: r.performanceIndex,
          taskCount: r.taskCount,
          avgScore: r.avgScore,
        },
      })
    )
  );

  return toRecommend;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!LEADERSHIP_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "This view is for HR, Admin, and Executive leadership" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || currentMonthLabel();

    let existing = await prisma.incentiveRecommendation.findMany({
      where: { month },
      include: { user: { select: { name: true, jobTitle: true, role: true, department: { select: { name: true } } } } },
      orderBy: [{ segment: "asc" }, { rank: "asc" }],
    });

    // Lazily generate on first request for a month that has nothing yet —
    // no separate "click to generate" step needed for the common case.
    if (existing.length === 0) {
      await computeAndStoreRecommendations(month);
      existing = await prisma.incentiveRecommendation.findMany({
        where: { month },
        include: { user: { select: { name: true, jobTitle: true, role: true, department: { select: { name: true } } } } },
        orderBy: [{ segment: "asc" }, { rank: "asc" }],
      });
    }

    return NextResponse.json({ month, recommendations: existing });
  } catch (error) {
    console.error("Incentive recommendations GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Force a refresh for the current month (e.g. mid-month, or after disputed
// entries get resolved and rankings should reflect that).
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || !LEADERSHIP_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const month = body.month || currentMonthLabel();
    await computeAndStoreRecommendations(month);
    return NextResponse.json({ success: true, month });
  } catch (error) {
    console.error("Incentive recommendations POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const actioner = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!actioner || !LEADERSHIP_ROLES.includes(actioner.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, hrNote } = body;
    if (!id || !["ACKNOWLEDGED", "ACTIONED", "DISMISSED"].includes(status)) {
      return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });
    }

    const updated = await prisma.incentiveRecommendation.update({
      where: { id },
      data: { status, hrNote: hrNote || null, actionedById: actioner.id, actionedAt: new Date() },
    });

    return NextResponse.json({ success: true, recommendation: updated });
  } catch (error) {
    console.error("Incentive recommendations PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}