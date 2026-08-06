import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "monthly";
    const deptId = searchParams.get("deptId") || null;

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const qMonth     = Math.floor(now.getMonth() / 3) * 3;
    const qStart     = new Date(now.getFullYear(), qMonth, 1);

    const dateFrom =
      period === "monthly"   ? monthStart :
      period === "quarterly" ? qStart     : yearStart;

    const users = await prisma.user.findMany({
      where: {
        role: { in: ["STAFF", "SUPERVISOR"] },
        ...(deptId ? { departmentId: deptId } : {}),
      },
      include: {
        department: true,
        unit:       true,
        dailyLogs: {
          where:  { createdAt: { gte: dateFrom } },
          select: {
            status:          true,
            priority:        true,
            timeSpent:       true,
            supervisorScore: true,
            taskCategory:    true,
            createdAt:       true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const appraisals = users.map((user) => {
      const logs        = user.dailyLogs;
      const totalLogs   = logs.length;
      const approved    = logs.filter((l) => l.status === "APPROVED").length;
      const rejected    = logs.filter((l) => l.status === "REJECTED").length;
      const submitted   = logs.filter((l) => l.status === "SUBMITTED").length;
      const totalHours  = logs.reduce((s, l) => s + l.timeSpent, 0);
      const scoredLogs  = logs.filter((l) => l.supervisorScore !== null);
      const avgScore    = scoredLogs.length > 0
        ? scoredLogs.reduce((s, l) => s + (l.supervisorScore || 0), 0) / scoredLogs.length
        : null;

      // Unique submission days
      const uniqueDays  = new Set(logs.map((l) => new Date(l.createdAt).toDateString())).size;

      // Priority breakdown
      const highPriority = logs.filter((l) => ["HIGH","CRITICAL"].includes(l.priority)).length;

      // Scoring formula (same as AI insights for consistency)
      const workingDays =
        period === "monthly"   ? 22 :
        period === "quarterly" ? 66 : 264;

      const freqScore    = Math.min((uniqueDays   / workingDays) * 100, 100);
      const approvalRate = totalLogs > 0 ? (approved / totalLogs) * 100 : 0;
      const qualScore    = avgScore !== null ? (avgScore / 10) * 100 : 50;
      const volScore     = Math.min((totalLogs / (workingDays * 1.5)) * 100, 100);

      const overallScore = Math.round(
        freqScore * 0.4 + approvalRate * 0.3 + qualScore * 0.2 + volScore * 0.1
      );

      const rating =
        overallScore >= 90 ? "Outstanding"     :
        overallScore >= 75 ? "Exceeds Expectation" :
        overallScore >= 60 ? "Meets Expectation"   :
        overallScore >= 45 ? "Below Expectation"   : "Unsatisfactory";

      const ratingColor =
        overallScore >= 90 ? "#4ade80" :
        overallScore >= 75 ? "#22c55e" :
        overallScore >= 60 ? "#60a5fa" :
        overallScore >= 45 ? "#f59e0b" : "#f87171";

      // Top task categories
      const catCounts: Record<string, number> = {};
      logs.forEach((l) => { catCounts[l.taskCategory] = (catCounts[l.taskCategory] || 0) + 1; });
      const topCategories = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, count]) => ({ cat, count }));

      return {
        id:            user.id,
        name:          user.name,
        email:         user.email,
        staffId:       user.staffId,
        department:    user.department?.name ?? "Unassigned",
        unit:          user.unit?.name ?? null,
        role:          user.role,
        period,
        dateFrom:      dateFrom.toISOString(),
        dateTo:        now.toISOString(),
        // Log stats
        totalLogs, approved, rejected, submitted,
        totalHours:    Math.round(totalHours * 10) / 10,
        uniqueDays,
        highPriority,
        avgScore:      avgScore ? Math.round(avgScore * 10) / 10 : null,
        topCategories,
        // Performance
        overallScore,
        rating,
        ratingColor,
        approvalRate:  Math.round(approvalRate),
        freqScore:     Math.round(freqScore),
        qualScore:     Math.round(qualScore),
        volScore:      Math.round(volScore),
      };
    });

    // Sort by score descending
    appraisals.sort((a, b) => b.overallScore - a.overallScore);

    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });

    const summary = {
      total:        appraisals.length,
      outstanding:  appraisals.filter((a) => a.rating === "Outstanding").length,
      exceeds:      appraisals.filter((a) => a.rating === "Exceeds Expectation").length,
      meets:        appraisals.filter((a) => a.rating === "Meets Expectation").length,
      below:        appraisals.filter((a) => a.rating === "Below Expectation").length,
      unsatisfactory: appraisals.filter((a) => a.rating === "Unsatisfactory").length,
      avgScore:     appraisals.length > 0
        ? Math.round(appraisals.reduce((s, a) => s + a.overallScore, 0) / appraisals.length)
        : 0,
    };

    return NextResponse.json({ appraisals, summary, departments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
