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

    // Fetch all staff with their logs in last 30 days
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

      // Unique days logged in last 30 days
      const uniqueDays = new Set(
        logs.map((l) => new Date(l.createdAt).toDateString())
      ).size;

      // Week logs for trend
      const weekLogs = logs.filter((l) => new Date(l.createdAt) >= day7ago).length;

      // ── Scoring algorithm ──────────────────────────────────────
      // 1. Log frequency (40%) — target: 22 days/month (working days)
      const freqScore  = Math.min((uniqueDays / 22) * 100, 100);

      // 2. Approval rate (30%)
      const approvalRate = totalLogs > 0 ? (approved / totalLogs) * 100 : 50;

      // 3. Supervisor quality scores (20%)
      const qualityScore = avgScore !== null ? (avgScore / 10) * 100 : 60;

      // 4. Output volume (10%) — target: 30 tasks/month
      const volumeScore  = Math.min((totalLogs / 30) * 100, 100);

      const overallScore = Math.round(
        freqScore * 0.4 + approvalRate * 0.3 + qualityScore * 0.2 + volumeScore * 0.1
      );

      // ── Recommendation logic ──────────────────────────────────
      let tag: string;
      let reason: string;
      let tagColor: "green" | "amber" | "red" | "blue";

      if (overallScore >= 85 && approved >= 15) {
        tag = "Promote"; tagColor = "green";
        reason = `Outstanding performance — ${totalLogs} tasks, ${Math.round(approvalRate)}% approval rate`;
      } else if (overallScore >= 70) {
        tag = "On Track"; tagColor = "blue";
        reason = `Consistent output — ${totalLogs} tasks logged, ${uniqueDays} active days`;
      } else if (uniqueDays < 10 && totalLogs < 10) {
        tag = "Low Activity"; tagColor = "amber";
        reason = `Only ${uniqueDays} active days and ${totalLogs} logs in 30 days`;
      } else if (rejected > approved && totalLogs > 5) {
        tag = "Quality Issues"; tagColor = "red";
        reason = `${rejected} rejected logs — quality review needed`;
      } else if (overallScore < 50) {
        tag = "Flag"; tagColor = "red";
        reason = `Below performance threshold — score ${overallScore}%`;
      } else {
        tag = "Watch"; tagColor = "amber";
        reason = `Performance trending below target — ${totalLogs} tasks, ${uniqueDays} active days`;
      }

      return {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        department:   user.department?.name ?? "Unassigned",
        overallScore,
        totalLogs,
        approved,
        rejected,
        totalHours:   Math.round(totalHours * 10) / 10,
        uniqueDays,
        weekLogs,
        avgScore:     avgScore ? Math.round(avgScore * 10) / 10 : null,
        tag,
        tagColor,
        reason,
      };
    });

    // Sort by score descending
    insights.sort((a, b) => b.overallScore - a.overallScore);

    // Department-level insights
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

    const summary = {
      totalStaff:          insights.length,
      promotionCandidates: insights.filter((i) => i.tag === "Promote").length,
      flagged:             insights.filter((i) => i.tag === "Flag").length,
      lowActivity:         insights.filter((i) => i.tag === "Low Activity").length,
      avgScore:            insights.length > 0
        ? Math.round(insights.reduce((s, i) => s + i.overallScore, 0) / insights.length)
        : 0,
    };

    return NextResponse.json({ insights, deptInsights, summary });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
