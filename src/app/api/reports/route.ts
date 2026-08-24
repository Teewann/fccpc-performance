import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── Helper: resolve target users based on role ──────────────────────
function resolveTargetUsers(
  caller: { id: string; role: string; departmentId: string | null },
  requestedUserId: string | null
): { userIds?: string[]; deptId?: string; error?: string } {
  const isOrgWide = ["HR", "ADMIN", "EXECUTIVE"].includes(caller.role);

  if (caller.role === "STAFF" || caller.role === "SUPERVISOR") {
    return { userIds: [caller.id] }; // always self, ignore any requested id
  }
  if (caller.role === "DIRECTOR") {
    if (requestedUserId) return { userIds: [requestedUserId] }; // server still checks department below
    return { deptId: caller.departmentId || undefined };
  }
  if (isOrgWide) {
    if (requestedUserId) return { userIds: [requestedUserId] };
    return {}; // org-wide, no filter
  }
  return { error: "Not permitted" };
}

// ─── GET - returns report data ──────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type   = searchParams.get("type")   || "staff-logs";
    const period = searchParams.get("period") || "monthly";
    const deptId = searchParams.get("deptId") || null;
    const requestedUserId = searchParams.get("targetUserId") || null;
    const customFrom = searchParams.get("dateFrom") || null;
    const customTo = searchParams.get("dateTo") || null;
    const deptIdsParam = searchParams.get("deptIds");
    const deptIdList = deptIdsParam ? deptIdsParam.split(",") : null;

    // Fetch the current user for the report header
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, role: true, staffId: true, departmentId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Resolve scope based on role ──────────────────────────────────
    const scope = resolveTargetUsers(
      { id: (session.user as any).id, role: user?.role || "", departmentId: user?.departmentId || null },
      requestedUserId
    );

    if (scope.error) {
      return NextResponse.json({ error: scope.error }, { status: 403 });
    }

    // ── Director check: can only report on their own department ──────
    if (user?.role === "DIRECTOR" && requestedUserId) {
      const target = await prisma.user.findUnique({ 
        where: { id: requestedUserId }, 
        select: { departmentId: true } 
      });
      if (!target || target.departmentId !== user.departmentId) {
        return NextResponse.json({ 
          error: "You can only generate reports for staff in your own department." 
        }, { status: 403 });
      }
    }

    // ── Admin check for audit trail and chat export ──────────────────
    if ((type === "audit-trail" || type === "chats") && user?.role !== "ADMIN") {
      return NextResponse.json({ 
        error: `Only Administrators can access the ${type === "audit-trail" ? "audit trail" : "chat export"} report.` 
      }, { status: 403 });
    }

    // ── Chat export requires Admin ──────────────────────────────────
    if (type === "chats" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Chat export is restricted to Administrators." }, { status: 403 });
    }

    // ── Communications report restricted ─────────────────────────────
    if (type === "communications" && !["HR", "DIRECTOR", "ADMIN", "EXECUTIVE"].includes(user?.role || "")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    // ── Exams report restricted ─────────────────────────────────────
    if (type === "exams" && !["HR", "ADMIN", "EXECUTIVE"].includes(user?.role || "")) {
      return NextResponse.json({ error: "Exam reports are restricted to HR, Admin, and Executive." }, { status: 403 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const qStart = new Date(now.getFullYear(), qMonth, 1);

    // ── Custom date range ────────────────────────────────────────────
    const dateFrom = 
      period === "custom" && customFrom ? new Date(customFrom) :
      period === "weekly"    ? new Date(new Date().setDate(now.getDate() - 7)) :
      period === "monthly"   ? monthStart :
      period === "quarterly" ? qStart : yearStart;

    const dateTo = period === "custom" && customTo 
      ? new Date(new Date(customTo).setHours(23, 59, 59, 999)) 
      : new Date();

    let rows: any[] = [];

    // ── STAFF LOGS ──────────────────────────────────────────────────────
    if (type === "staff-logs") {
      const logs = await prisma.dailyLog.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          ...(deptId ? { user: { departmentId: deptId } } : {}),
          ...(deptIdList ? { user: { departmentId: { in: deptIdList } } } : {}),
          ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
          ...(scope.deptId ? { user: { departmentId: scope.deptId } } : {}),
        },
        include: {
          user: { include: { department: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      rows = logs.map((l) => ({
        staffName:   l.user.name,
        staffEmail:  l.user.email,
        department:  l.user.department?.name ?? "Unassigned",
        unit:        l.user.unit?.name ?? "",
        taskTitle:   l.taskTitle,
        taskCategory:l.taskCategory,
        description: l.description,
        timeSpent:   l.timeSpent,
        priority:    l.priority,
        status:      l.status,
        caseRef:     l.caseReference ?? "",
        supervisorScore: l.supervisorScore ?? "",
        supervisorComment: l.supervisorComment ?? "",
        date: new Date(l.createdAt).toLocaleDateString("en-GB"),
      }));
    }

    // ── KPI SUMMARY ──────────────────────────────────────────────────
    else if (type === "kpi-summary") {
      const kpis = await prisma.kPI.findMany({
        where: {
          ...(deptId ? { departmentId: deptId } : {}),
          ...(deptIdList ? { departmentId: { in: deptIdList } } : {}),
          ...(scope.deptId ? { departmentId: scope.deptId } : {}),
        },
        include: { department: true },
      });

      rows = kpis.map((k) => {
        const pct = k.target > 0 ? Math.round((k.current / k.target) * 100) : 0;
        return {
          department: k.department.name,
          kpiTitle:   k.title,
          target:     k.target,
          current:    k.current,
          unit:       k.unit,
          percentage: `${pct}%`,
          period:     k.period,
          status:     pct >= 90 ? "On Track" : pct >= 60 ? "At Risk" : "Behind",
          startDate:  new Date(k.startDate).toLocaleDateString("en-GB"),
          endDate:    new Date(k.endDate).toLocaleDateString("en-GB"),
        };
      });
    }

    // ── DEPARTMENT RANKING ────────────────────────────────────────────
    else if (type === "dept-ranking") {
      const deptFilter = deptIdList ? { id: { in: deptIdList } } : (scope.deptId ? { id: scope.deptId } : {});
      const depts = await prisma.department.findMany({
        where: deptFilter,
        include: {
          users: {
            include: {
              dailyLogs: {
                where: { createdAt: { gte: dateFrom, lte: dateTo } },
                select: { status: true, supervisorScore: true, timeSpent: true },
              },
            },
          },
          _count: { select: { users: true } },
        },
      });

      rows = depts.map((d) => {
        const allLogs   = d.users.flatMap((u) => u.dailyLogs);
        const approved  = allLogs.filter((l) => l.status === "APPROVED").length;
        const total     = allLogs.length;
        const rate      = total > 0 ? Math.round((approved / total) * 100) : 0;
        const avgScore  = allLogs.filter((l) => l.supervisorScore).length > 0
          ? Math.round(allLogs.reduce((s, l) => s + (l.supervisorScore || 0), 0) /
              allLogs.filter((l) => l.supervisorScore).length * 10) / 10
          : 0;

        return {
          department:   d.name,
          shortCode:    d.shortCode,
          staffCount:   d._count.users,
          totalLogs:    total,
          approvedLogs: approved,
          approvalRate: `${rate}%`,
          avgQualityScore: avgScore,
          status: rate >= 80 ? "On Track" : rate >= 60 ? "At Risk" : "Behind",
        };
      }).sort((a, b) => parseInt(b.approvalRate) - parseInt(a.approvalRate));
    }

    // ── APPRAISAL ──────────────────────────────────────────────────────
    else if (type === "appraisal") {
      const users = await prisma.user.findMany({
        where: {
          role: "STAFF",
          ...(scope.userIds ? { id: { in: scope.userIds } } : {}),
          ...(scope.deptId ? { departmentId: scope.deptId } : {}),
          ...(deptIdList ? { departmentId: { in: deptIdList } } : {}),
        },
        include: {
          department: true,
          dailyLogs: {
            where:  { createdAt: { gte: dateFrom, lte: dateTo } },
            select: { status: true, supervisorScore: true, timeSpent: true, priority: true },
          },
        },
      });

      rows = users.map((u) => {
        const logs       = u.dailyLogs;
        const approved   = logs.filter((l) => l.status === "APPROVED").length;
        const total      = logs.length;
        const totalHours = logs.reduce((s, l) => s + l.timeSpent, 0);
        const avgScore   = logs.filter((l) => l.supervisorScore).length > 0
          ? Math.round(logs.reduce((s, l) => s + (l.supervisorScore || 0), 0) /
              logs.filter((l) => l.supervisorScore).length * 10) / 10
          : null;
        const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

        return {
          staffName:       u.name,
          staffId:         u.staffId ?? "",
          department:      u.department?.name ?? "Unassigned",
          totalLogs:       total,
          approved,
          approvalRate:    `${rate}%`,
          totalHours:      Math.round(totalHours * 10) / 10,
          avgQualityScore: avgScore ?? "N/A",
          performanceRating:
            rate >= 85 ? "Excellent" :
            rate >= 70 ? "Good"      :
            rate >= 55 ? "Satisfactory" : "Needs Improvement",
          status: rate >= 85 ? "Excellent" : rate >= 70 ? "Good" : rate >= 55 ? "Satisfactory" : "Needs Improvement",
        };
      });
    }

    // ── AUDIT TRAIL ──────────────────────────────────────────────────
    else if (type === "audit-trail") {
      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
          ...(deptIdList ? { user: { departmentId: { in: deptIdList } } } : {}),
        },
        include: { user: { include: { department: true } } },
        orderBy: { createdAt: "desc" },
      });

      rows = logs.map((l) => ({
        staffName:  l.user.name,
        staffEmail: l.user.email,
        role:       l.user.role,
        department: l.user.department?.name ?? "-",
        action:     l.action.replace(/_/g, " "),
        detail:     l.detail ?? "",
        ipAddress:  l.ipAddress ?? "-",
        dateTime:   new Date(l.createdAt).toLocaleString("en-GB"),
      }));
    }

    // ── TASKS REPORT ──────────────────────────────────────────────────
    else if (type === "tasks") {
      const [deptTasks, evcTasks] = await Promise.all([
        prisma.task.findMany({
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            ...(scope.userIds ? { assignedToId: { in: scope.userIds } } : {}),
            ...(scope.deptId ? { departmentId: scope.deptId } : {}),
            ...(deptIdList ? { departmentId: { in: deptIdList } } : {}),
          },
          include: { assignedTo: true, createdBy: true, department: true },
        }),
        prisma.eVCTask.findMany({
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            ...(scope.userIds ? { assignedToId: { in: scope.userIds } } : {}),
          },
          include: { assignedTo: true, createdBy: true },
        }),
      ]);

      rows = [
        ...deptTasks.map((t) => ({
          source: "Department",
          title: t.title,
          department: t.department?.name ?? "—",
          assignedTo: t.assignedTo?.name ?? "Unassigned",
          assignedBy: t.createdBy.name,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "—",
          completedAt: t.completedAt ? new Date(t.completedAt).toLocaleDateString("en-GB") : "—",
          createdAt: new Date(t.createdAt).toLocaleDateString("en-GB"),
        })),
        ...evcTasks.map((t) => ({
          source: "EVC",
          title: t.title,
          department: "Executive",
          assignedTo: t.assignedTo.name,
          assignedBy: t.createdBy.name,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "—",
          completedAt: t.completedAt ? new Date(t.completedAt).toLocaleDateString("en-GB") : "—",
          createdAt: new Date(t.createdAt).toLocaleDateString("en-GB"),
        })),
      ];
    }

    // ── COMMUNICATIONS REPORT ─────────────────────────────────────────
    else if (type === "communications") {
      if (!["HR", "DIRECTOR", "ADMIN", "EXECUTIVE"].includes(user?.role || "")) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
      const [announcements, memos] = await Promise.all([
        prisma.announcement.findMany({
          where: { createdAt: { gte: dateFrom, lte: dateTo } },
          include: { author: true },
        }),
        prisma.memo.findMany({
          where: { createdAt: { gte: dateFrom, lte: dateTo } },
          include: { sender: true, recipients: true },
        }),
      ]);

      rows = [
        ...announcements.map((a) => ({
          type: "Announcement",
          title: a.title,
          postedBy: a.author.name,
          role: a.author.role,
          audience: a.targetDeptId ? "One department" : "All staff",
          engagement: "—",
          pinned: a.isPinned ? "Yes" : "",
          date: new Date(a.createdAt).toLocaleDateString("en-GB"),
        })),
        ...memos.map((m) => {
          const readCount = m.recipients.filter((r) => r.read).length;
          return {
            type: "Memo",
            title: m.subject,
            postedBy: m.sender.name,
            role: m.sender.role,
            audience: `${m.recipients.length} recipient${m.recipients.length !== 1 ? "s" : ""}`,
            engagement: m.recipients.length > 0 ? `${readCount}/${m.recipients.length} read (${Math.round((readCount / m.recipients.length) * 100)}%)` : "—",
            pinned: "",
            date: new Date(m.createdAt).toLocaleDateString("en-GB"),
          };
        }),
      ];
    }

    // ── LEAVE REPORT ──────────────────────────────────────────────────
    else if (type === "leave") {
      const leaves = await prisma.leaveRequest.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
          ...(scope.deptId ? { user: { departmentId: scope.deptId } } : {}),
          ...(deptIdList ? { user: { departmentId: { in: deptIdList } } } : {}),
        },
        select: {
          type: true,
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          reason: true,
          createdAt: true,
          user: { select: { name: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });

      rows = leaves.map((l) => ({
        staffName: l.user.name,
        department: l.user.department?.name ?? "—",
        type: l.type,
        startDate: new Date(l.startDate).toLocaleDateString("en-GB"),
        endDate: new Date(l.endDate).toLocaleDateString("en-GB"),
        days: l.days,
        status: l.status,
        reason: l.reason,
        requested: new Date(l.createdAt).toLocaleDateString("en-GB"),
      }));
    }

    // ── ATTENDANCE REPORT ─────────────────────────────────────────────
    else if (type === "attendance") {
      const checkIns = await prisma.checkIn.findMany({
        where: {
          date: { gte: dateFrom, lte: dateTo },
          ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
          ...(scope.deptId ? { user: { departmentId: scope.deptId } } : {}),
          ...(deptIdList ? { user: { departmentId: { in: deptIdList } } } : {}),
        },
        select: {
          date: true,
          checkInAt: true,
          checkOutAt: true,
          hoursWorked: true,
          status: true,
          isOnPremises: true,
          checkOutIsOnPremises: true,
          verificationMethod: true,
          user: { select: { name: true, department: { select: { name: true } } } },
        },
        orderBy: { date: "desc" },
        take: 2000,
      });

      rows = checkIns.map((c) => ({
        staffName: c.user.name,
        department: c.user.department?.name ?? "—",
        date: new Date(c.date).toLocaleDateString("en-GB"),
        checkIn: new Date(c.checkInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        checkOut: c.checkOutAt ? new Date(c.checkOutAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—",
        hours: c.hoursWorked ?? "—",
        status: c.status,
        location: `In: ${c.isOnPremises ? "On-premises" : "Outside"}${c.checkOutAt ? ` · Out: ${c.checkOutIsOnPremises ? "On-premises" : "Outside"}` : ""}`,
        method: c.verificationMethod ?? "Unverified",
      }));
    }

    // ── EXAMS REPORT ──────────────────────────────────────────────────
    else if (type === "exams") {
      if (!["HR", "ADMIN", "EXECUTIVE"].includes(user?.role || "")) {
        return NextResponse.json({ error: "Exam reports are restricted to HR, Admin, and Executive." }, { status: 403 });
      }

      const attempts = await prisma.examAttempt.findMany({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          ...(scope.userIds ? { userId: { in: scope.userIds } } : {}),
        },
        select: {
          score: true,
          percentage: true,
          passed: true,
          completedAt: true,
          createdAt: true,
          exam: { select: { title: true, targetRole: true, passMark: true } },
          user: { select: { name: true, department: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });

      rows = attempts.map((a) => ({
        staffName: a.user.name,
        department: a.user.department?.name ?? "—",
        exam: a.exam.title,
        targetRole: a.exam.targetRole,
        score: a.score,
        percentage: `${a.percentage}%`,
        passMark: `${a.exam.passMark}%`,
        result: a.passed ? "Passed" : "Failed",
        completedAt: a.completedAt ? new Date(a.completedAt).toLocaleDateString("en-GB") : "In progress",
      }));
    }

    // ── STAFF DIRECTORY REPORT ────────────────────────────────────────
    else if (type === "staff-directory") {
      const staff = await prisma.user.findMany({
        where: {
          ...(deptIdList ? { departmentId: { in: deptIdList } } : {}),
          ...(scope.deptId ? { departmentId: scope.deptId } : {}),
        },
        select: {
          name: true,
          email: true,
          staffId: true,
          role: true,
          jobTitle: true,
          gradeLevel: true,
          isActive: true,
          createdAt: true,
          department: { select: { name: true } },
          unit: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      });

      rows = staff.map((u) => ({
        name: u.name,
        email: u.email,
        staffId: u.staffId ?? "—",
        role: u.role,
        jobTitle: u.jobTitle ?? "—",
        gradeLevel: u.gradeLevel ?? "—",
        department: u.department?.name ?? "Unassigned",
        unit: u.unit?.name ?? "—",
        status: u.isActive ? "Active" : "Inactive",
        joined: new Date(u.createdAt).toLocaleDateString("en-GB"),
      }));
    }

    // ── CHAT EXPORT REPORT ────────────────────────────────────────────
    else if (type === "chats") {
      if (user?.role !== "ADMIN") {
        return NextResponse.json({ error: "Chat export is restricted to Administrators." }, { status: 403 });
      }

      const messages = await prisma.chatMessage.findMany({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
        select: {
          content: true,
          createdAt: true,
          sender: { select: { name: true, role: true } },
          conversation: {
            select: {
              name: true,
              isGroup: true,
              participants: { select: { user: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });

      rows = messages.map((m) => ({
        sender: m.sender.name,
        role: m.sender.role,
        conversation: m.conversation.name || (m.conversation.isGroup ? "Group chat" : "Direct message"),
        participants: m.conversation.participants.map((p) => p.user.name).join(", "),
        message: m.content ?? "[attachment]",
        date: new Date(m.createdAt).toLocaleString("en-GB"),
      }));

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "CHAT_EXPORT_GENERATED",
          detail: `Exported ${rows.length} chat messages, period: ${period}`,
        },
      });
    }

        // ── KPI TREND REPORT ─────────────────────────────────────────────
    else if (type === "kpi-trend") {
      const kpis = await prisma.kPI.findMany({
        where: {
          ...(deptIdList ? { departmentId: { in: deptIdList } } : {}),
          ...(scope.deptId ? { departmentId: scope.deptId } : {}),
        },
        select: {
          title: true,
          target: true,
          unit: true,
          department: { select: { name: true } },
          snapshots: {
            where: { recordedAt: { gte: dateFrom, lte: dateTo } },
            orderBy: { recordedAt: "asc" },
            select: { value: true, recordedAt: true },
          },
        },
      });

      rows = kpis.flatMap((k) =>
        k.snapshots.map((s) => ({
          kpi: k.title,
          department: k.department.name,
          value: s.value,
          target: k.target,
          unit: k.unit,
          percentage: k.target > 0 ? `${Math.round((s.value / k.target) * 100)}%` : "—",
          recordedAt: new Date(s.recordedAt).toLocaleDateString("en-GB"),
        }))
      );
    }

    // ─── RETURN RESPONSE ──────────────────────────────────────────────
    return NextResponse.json({
      rows,
      count: rows.length,
      period,
      type,
      meta: {
        requestedBy: {
          name: user?.name || "Unknown",
          role: user?.role || "Unknown",
          staffId: user?.staffId || "",
          email: session.user.email,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}