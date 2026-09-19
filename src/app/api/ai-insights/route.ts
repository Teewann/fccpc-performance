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

    const now      = new Date();
    const day30ago = new Date(now); day30ago.setDate(now.getDate() - 30);
    const day7ago  = new Date(now); day7ago.setDate(now.getDate() - 7);

    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        department: true,
        dailyLogs: {
          where: { createdAt: { gte: day30ago } },
          select: {
            status: true,
            priority: true,
            timeSpent: true,
            supervisorScore: true,
            createdAt: true,
          },
        },
      },
    });

    const completedGroups = await prisma.task.groupBy({
      by: ["assignedToId"],
      where: {
        status: "COMPLETED",
        completedAt: { gte: day30ago },
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

    const insights = users.map((user) => {
      const logs         = user.dailyLogs;
      const totalLogs    = logs.length;
      const approved     = logs.filter((l) => l.status === "APPROVED").length;
      const rejected     = logs.filter((l) => l.status === "REJECTED").length;
      const totalHours   = logs.reduce((s, l) => s + l.timeSpent, 0);
      const avgScore     = logs.filter((l) => l.supervisorScore !== null).length > 0
        ? logs.reduce((s, l) => s + (l.supervisorScore || 0), 0) /
          logs.filter((l) => l.supervisorScore !== null).length
        : null;

      const uniqueDays = new Set(
        logs.map((l) => new Date(l.createdAt).toDateString())
      ).size;

      const weekLogs = logs.filter((l) => new Date(l.createdAt) >= day7ago).length;

      const completedTasks = completedMap[user.id] || 0;
      const overdueTasks   = overdueMap[user.id]   || 0;

      const logPoints        = approved * 3;
      const taskPoints       = completedTasks * 3;
      const hasApprovedWork  = approved > 0 || completedTasks > 0;
      const qualityBonus     = hasApprovedWork && avgScore !== null ? (avgScore / 100) * 15 : 0;
      const consistencyBonus = hasApprovedWork ? Math.min(uniqueDays * 1.25, 10) : 0;
      const overdueePenalty  = Math.min(overdueTasks * 2, 20);

      const rawScore = logPoints + taskPoints + qualityBonus + consistencyBonus - overdueePenalty;
      const overallScore = Math.max(0, Math.min(Math.round(rawScore), 100));

      let tag: string;
      let reason: string;
      let tagColor: "green" | "amber" | "red" | "blue";

      if (totalLogs === 0 && completedTasks === 0 && overdueTasks === 0) {
        tag = "Low Activity"; tagColor = "amber";
        reason = `No activity in the last 30 days`;
      } else if (overdueTasks > 5) {
        tag = "Quality Issues"; tagColor = "red";
        reason = `${overdueTasks} overdue tasks, ${overdueePenalty} point penalty applied`;
      } else if (overallScore >= 70 && approved >= 10) {
        tag = "Promote"; tagColor = "green";
        reason = `Top performer: ${approved} approved logs, ${completedTasks} tasks completed`;
      } else if (overallScore >= 50) {
        tag = "On Track"; tagColor = "blue";
        reason = `Solid output: ${approved} approved logs, ${completedTasks} tasks completed`;
      } else if (overallScore >= 30) {
        tag = "Watch"; tagColor = "amber";
        reason = `${totalLogs} logs, ${approved} approved${overdueTasks > 0 ? `, ${overdueTasks} overdue` : ""}`;
      } else {
        tag = "Flag"; tagColor = "red";
        reason = `Below threshold, score ${overallScore}`;
      }

      return {
        id:             user.id,
        name:           user.name,
        email:          user.email,
        department:     user.department?.name ?? "Unassigned",
        overallScore,
        totalLogs,
        approved,
        rejected,
        completedTasks,
        overdueTasks,
        totalHours:     Math.round(totalHours * 10) / 10,
        uniqueDays,
        weekLogs,
        avgScore:       avgScore ? Math.round(avgScore * 10) / 10 : null,
        tag,
        tagColor,
        reason,
      };
    });

    insights.sort((a, b) => b.overallScore - a.overallScore);

    // ── Department-level insights (unchanged) ──────────────────────
    const deptGroups = await prisma.department.findMany({
      include: {
        users: {
          include: {
            dailyLogs: {
              where: { createdAt: { gte: day30ago } },
              select: { status: true, timeSpent: true },
            },
          },
        },
      },
    });

    const deptInsights = deptGroups.map((dept) => {
      const allLogs  = dept.users.flatMap((u) => u.dailyLogs);
      const approved = allLogs.filter((l) => l.status === "APPROVED").length;
      const total    = allLogs.length;
      const rate     = total > 0 ? Math.round((approved / total) * 100) : 0;
      return {
        id:           dept.id,
        name:         dept.name,
        shortCode:    dept.shortCode,
        totalLogs:    total,
        approvedLogs: approved,
        approvalRate: rate,
        staffCount:   dept.users.length,
        status:       rate >= 80 ? "ON_TRACK" : rate >= 60 ? "AT_RISK" : "BEHIND",
      };
    }).sort((a, b) => b.approvalRate - a.approvalRate);

    // Summary uses only staff with approved work for realistic averages
    const activeInsights = insights.filter((i) => i.approved > 0 || i.completedTasks > 0);

    const summary = {
      totalStaff:          activeInsights.length,
      promotionCandidates: insights.filter((i) => i.tag === "Promote").length,
      flagged:             insights.filter((i) => i.tag === "Flag").length,
      lowActivity:         insights.filter((i) => i.tag === "Low Activity").length,
      avgScore:            activeInsights.length > 0
        ? Math.round(activeInsights.reduce((s, i) => s + i.overallScore, 0) / activeInsights.length)
        : 0,
    };

    return NextResponse.json({ insights, deptInsights, summary });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}