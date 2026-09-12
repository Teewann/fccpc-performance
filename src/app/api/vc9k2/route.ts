import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── GET - full EVC intelligence data ────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

        if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") || "overview";

    // ✅ AUDIT: record EVC suite access (only for overview to avoid spamming)
    if (section === "overview") {
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "EVC_SUITE_ACCESS",
            detail: `Executive accessed EVC Suite (section: ${section})`,
          },
        });
      } catch (e) {
        console.error("[audit] evc access log failed:", e);
      }
    }

    if (section === "overview") {
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalStaff, totalDepts, logsThisMonth, approvedLogs,
        pendingLogs, totalTasks, completedTasks, pendingLeave,
        revenueItems, pendingApprovals,
      ] = await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.department.count(),
        prisma.dailyLog.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.dailyLog.count({ where: { status: "APPROVED", createdAt: { gte: monthStart } } }),
        prisma.dailyLog.count({ where: { status: "SUBMITTED" } }),
        prisma.task.count(),
        prisma.task.count({ where: { status: "COMPLETED" } }),
        prisma.leaveRequest.count({ where: { status: "PENDING" } }),
        prisma.revenueItem.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.revenueItem.findMany({
          where: { status: "PENDING_EVC_APPROVAL" },
          include: {
            submittedBy: {
              select: { name: true, department: { select: { name: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const logRate      = totalStaff > 0 ? (logsThisMonth / (totalStaff * 22)) * 100 : 0;
      const approvalRate = logsThisMonth > 0 ? (approvedLogs / logsThisMonth) * 100 : 0;
      const taskRate     = totalTasks   > 0 ? (completedTasks / totalTasks) * 100 : 0;
      const healthScore  = Math.min(100, Math.round((logRate * 0.4) + (approvalRate * 0.35) + (taskRate * 0.25)));

      const totalRevenue    = revenueItems.reduce((s, r) => s + r.amount, 0);
      const approvedRevenue = revenueItems.filter((r) => r.status === "APPROVED_BY_EVC").reduce((s, r) => s + r.amount, 0);
      const pendingRevenue  = revenueItems.filter((r) => r.status === "PENDING_EVC_APPROVAL").reduce((s, r) => s + r.amount, 0);
      const bySource        = revenueItems.reduce((acc: Record<string, number>, r) => {
        acc[r.source] = (acc[r.source] || 0) + r.amount;
        return acc;
      }, {});

      return NextResponse.json({
        overview: {
          totalStaff, totalDepts, logsThisMonth, approvedLogs,
          pendingLogs, totalTasks, completedTasks, pendingLeave,
          healthScore,
          logRate:      Math.round(logRate),
          approvalRate: Math.round(approvalRate),
          taskRate:     Math.round(taskRate),
        },
        revenue: {
          total:            totalRevenue,
          approved:         approvedRevenue,
          pending:          pendingRevenue,
          bySource,
          items:            revenueItems.slice(0, 20),
          pendingApprovals,
        },
      });
    }

    if (section === "directors") {
      const directors = await prisma.user.findMany({
        where: { role: "DIRECTOR" },
        include: { department: true, createdTasks: { select: { status: true } } },
      });

      const directorStats = await Promise.all(
        directors.map(async (d) => {
          const [deptLogs, approvedByDir, pendingForDir] = await Promise.all([
            prisma.dailyLog.count({ where: { user: { departmentId: d.departmentId ?? undefined } } }),
            prisma.dailyLog.count({ where: { supervisorId: d.id, status: "APPROVED" } }),
            prisma.dailyLog.count({ where: { user: { departmentId: d.departmentId ?? undefined }, status: "SUBMITTED" } }),
          ]);
          return {
            id: d.id, name: d.name, email: d.email,
            department:     d.department?.name || "Unassigned",
            deptLogs, approvedByDir, pendingForDir,
            tasksCreated:   d.createdTasks.length,
            tasksCompleted: d.createdTasks.filter((t) => t.status === "COMPLETED").length,
          };
        })
      );
      return NextResponse.json({ directors: directorStats });
    }

    if (section === "annotations") {
      const notes = await prisma.eVCAnnotation.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ notes });
    }

    if (section === "promotions") {
      const staff = await prisma.user.findMany({
        where: { role: { in: ["STAFF", "SUPERVISOR"] }, isActive: true },
        include: {
          department: true,
          dailyLogs:   { select: { status: true, supervisorScore: true }, take: 100, orderBy: { createdAt: "desc" } },
          examAttempts: { select: { percentage: true, passed: true }, orderBy: { completedAt: "desc" }, take: 1 },
        },
      });

      const recommendations = staff.map((s) => {
        const logs      = s.dailyLogs;
        const approved  = logs.filter((l) => l.status === "APPROVED").length;
        const rate      = logs.length > 0 ? (approved / logs.length) * 100 : 0;
        const scored    = logs.filter((l) => l.supervisorScore !== null);
        const avgScore  = scored.length > 0
          ? scored.reduce((a, l) => a + (l.supervisorScore || 0), 0) / scored.length : 0;
        const examPassed = s.examAttempts[0]?.passed || false;
        const perfScore  = Math.round((rate * 0.5) + (avgScore * 5) + (examPassed ? 20 : 0));
        return {
          id: s.id, name: s.name,
          department:  s.department?.name || "Unassigned",
          role:        s.role,
          approvalRate: Math.round(rate),
          avgScore:    Math.round(avgScore * 10) / 10,
          examPassed,
          perfScore,
          recommendation:
            perfScore >= 80 ? "Strongly recommend promotion"  :
            perfScore >= 65 ? "Recommend for review"          :
            perfScore >= 50 ? "Monitor performance"            : "Performance improvement needed",
        };
      }).sort((a, b) => b.perfScore - a.perfScore);

      return NextResponse.json({ recommendations });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("EVC GET error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// ─── POST - revenue item OR annotation ───────────────────────────────
// Handles both JSON and FormData
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";

    let type: string;
    let fields: Record<string, string> = {};
    let documentData: string | null = null;
    let documentName: string | null = null;
    let documentType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // FormData request
      const fd = await request.formData();
      type = fd.get("type") as string;

      for (const [key, value] of fd.entries()) {
        if (typeof value === "string") {
          fields[key] = value;
        }
      }

      const file = fd.get("document") as File | null;
      if (file && file.size > 0) {
        const bytes  = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        documentData = `data:${file.type};base64,${buffer.toString("base64")}`;
        documentName = file.name;
        documentType = file.type;
      }
    } else {
      // JSON request
      const body = await request.json();
      type = body.type;
      fields = body;
    }

    // ── Revenue item ───────────────────────────────────────────────
    if (type === "revenue") {
      const { title, amount, source, reference, department, notes } = fields;

      if (!title?.trim() || !amount || !source) {
        return NextResponse.json(
          { error: "Title, amount and source are required" },
          { status: 400 }
        );
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: "Amount must be a valid positive number" }, { status: 400 });
      }

      const item = await prisma.revenueItem.create({
        data: {
          title:        title.trim(),
          amount:       parsedAmount,
          source,
          reference:    reference?.trim()  || null,
          department:   department?.trim() || null,
          notes:        notes?.trim()      || null,
          documentData: documentData       || null,
          documentName: documentName       || null,
          documentType: documentType       || null,
          submittedById: user.id,
          status:       "PENDING_EVC_APPROVAL",
        },
      });

      return NextResponse.json({ success: true, item }, { status: 201 });
    }

    // ── Annotation / private note ──────────────────────────────────
    if (type === "annotation") {
      const { subject, content, priority } = fields;

      if (!subject?.trim() || !content?.trim()) {
        return NextResponse.json({ error: "Subject and content are required" }, { status: 400 });
      }

      const note = await prisma.eVCAnnotation.create({
        data: {
          userId:   user.id,
          subject:  subject.trim(),
          content:  content.trim(),
          priority: priority || "NORMAL",
        },
      });
      return NextResponse.json({ success: true, note }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("EVC POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH - EVC approves or rejects a revenue item ──────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { itemId, action, evcComment } = body;

    if (!itemId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "itemId and action required" }, { status: 400 });
    }

    const status =
      action === "approve" ? "APPROVED_BY_EVC" : "REJECTED_BY_EVC";

    const item = await prisma.revenueItem.update({
      where: { id: itemId },
      data: {
        status,
        evcComment:   evcComment || null,
        reviewedById: user.id,
        reviewedAt:   new Date(),
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("EVC PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}