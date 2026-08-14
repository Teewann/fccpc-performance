import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── Generate random 10-character task ref ────────────────────────────
async function generateTaskRef(): Promise<string> {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const LEN = 10;
  for (let attempt = 0; attempt < 30; attempt++) {
    let code = "";
    for (let i = 0; i < LEN; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
    const existing = await prisma.task.findUnique({ where: { taskRef: code } });
    if (!existing) return code;
  }
  return Date.now().toString(36).toUpperCase().slice(-10);
}

const taskIncludes = {
  department:    { select: { name: true } },
  assignedTo:    { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
  createdBy:     { select: { id: true, name: true, role: true } },
  forwardedTo:   { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
  forwardedFrom: { select: { id: true, name: true, role: true } },
};

// ─── Helper: find all Finance department staff ────────────────────────
async function getFinanceStaff(excludeIds: string[] = []) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      department: { name: { contains: "finance", mode: "insensitive" } },
      id: { notIn: excludeIds },
    },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

// ─── Helper: find Finance Director ───────────────────────────────────
async function getFinanceDirector() {
  return prisma.user.findFirst({
    where: {
      isActive: true,
      role: "DIRECTOR",
      department: { name: { contains: "finance", mode: "insensitive" } },
    },
    select: { id: true, name: true },
  });
}

// ─── GET ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ Get user directly from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { department: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "assigned";
    const search = searchParams.get("search") || "";
    const targetUserId = searchParams.get("userId");

    // Special endpoint: return Finance staff list for payment routing UI
    if (searchParams.get("financeStaff") === "1") {
      const staff = await getFinanceStaff();
      return NextResponse.json({ financeStaff: staff });
    }

    const isPrivileged = ["DIRECTOR", "SUPERVISOR", "HR", "ADMIN", "EXECUTIVE"].includes(user.role);

    // ── Build view conditions ──────────────────────────────────────
    let viewCondition: any = {};

    if (targetUserId && isPrivileged) {
      viewCondition = { assignedToId: targetUserId };
    } else if (view === "assigned") {
      viewCondition = {
        OR: [
          { assignedToId: user.id },
          { forwardedToId: user.id },
        ],
      };
    } else if (view === "created") {
      viewCondition = { createdById: user.id };
    } else if (view === "department") {
      if (!user.departmentId) {
        return NextResponse.json({ tasks: [], counts: buildZeroCounts(), loadWarning: "" });
      }
      viewCondition = { departmentId: user.departmentId };
    } else if (view === "all") {
      const deptCondition = user.departmentId ? { departmentId: user.departmentId } : null;
      viewCondition = {
        OR: [
          { assignedToId: user.id },
          { forwardedToId: user.id },
          { createdById: user.id },
          ...(deptCondition ? [deptCondition] : []),
        ],
      };
    } else {
      viewCondition = {
        OR: [
          { assignedToId: user.id },
          { createdById: user.id },
          { forwardedToId: user.id },
        ],
      };
    }

    // ── Add search filter ──────────────────────────────────────────
    const andConditions: any[] = [viewCondition];
    if (search) {
      andConditions.push({
        OR: [
          { taskRef: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { caseReference: { contains: search, mode: "insensitive" } },
          { assignedTo: { name: { contains: search, mode: "insensitive" } } },
          { createdBy: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const whereClause = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };

    // ── Execute query with proper includes ──────────────────────────
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        department: { select: { name: true } },
        assignedTo: { 
          select: { id: true, name: true, role: true, department: { select: { name: true } } } 
        },
        createdBy: { select: { id: true, name: true, role: true } },
        forwardedTo: { 
          select: { id: true, name: true, role: true, department: { select: { name: true } } } 
        },
        forwardedFrom: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── Sort EVC tasks to top ──────────────────────────────────────
    const sortedTasks = [
      ...tasks.filter(t => (t as any).taskSource === "EVC"),
      ...tasks.filter(t => (t as any).taskSource !== "EVC"),
    ];

    // ── Overdue escalation logic ──────────────────────────────────
    const now = new Date();
    const overdueTasks = sortedTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now &&
      !["COMPLETED", "CANCELLED"].includes(t.status) &&
      (t as any).treatmentStatus !== "ESCALATED"
    );

    if (overdueTasks.length > 0 && user.departmentId) {
      const director = await prisma.user.findFirst({
        where: { departmentId: user.departmentId, role: "DIRECTOR" },
      });
      if (director) {
        for (const ot of overdueTasks.slice(0, 5)) {
          const alreadyNotified = await prisma.notification.findFirst({
            where: {
              userId: director.id,
              title: { contains: ot.taskRef || ot.id },
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          });
          if (!alreadyNotified) {
            await prisma.notification.create({
              data: {
                userId: director.id,
                title: `⚠ Overdue task: ${ot.taskRef || ""}`,
                message: `Task "${ot.title}" assigned to ${ot.assignedTo?.name || "staff"} is overdue. Due: ${new Date(ot.dueDate!).toLocaleDateString("en-GB")}.`,
                type: "ALERT",
                link: "/tasks",
              },
            });
          }
        }
      }
    }

    // ── Calculate counts ───────────────────────────────────────────
    const myLoad = await prisma.task.count({
      where: {
        OR: [{ assignedToId: user.id }, { forwardedToId: user.id }],
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    });

    let loadWarning = "";
    if (myLoad >= 15) loadWarning = `Critical load: ${myLoad} active tasks. Consider delegating.`;
    else if (myLoad >= 10) loadWarning = `You have ${myLoad} active tasks. Prioritise carefully.`;

    const counts = {
      total: sortedTasks.length,
      pending: sortedTasks.filter(t => t.status === "PENDING").length,
      inProgress: sortedTasks.filter(t => t.status === "IN_PROGRESS").length,
      underTreatment: sortedTasks.filter(t => (t as any).treatmentStatus === "UNDER_TREATMENT").length,
      awaitingResponse: sortedTasks.filter(t => (t as any).treatmentStatus === "AWAITING_RESPONSE").length,
      treated: sortedTasks.filter(t => (t as any).treatmentStatus === "TREATED").length,
      completed: sortedTasks.filter(t => t.status === "COMPLETED").length,
      escalated: sortedTasks.filter(t => (t as any).treatmentStatus === "ESCALATED").length,
      forwarded: sortedTasks.filter(t => (t as any).treatmentStatus === "FORWARDED" || !!(t as any).forwardedToId).length,
      overdue: sortedTasks.filter(t =>
        t.dueDate && new Date(t.dueDate) < now && !["COMPLETED", "CANCELLED"].includes(t.status)
      ).length,
      myLoad,
    };

    return NextResponse.json({ tasks: sortedTasks, counts, loadWarning });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "Server error: " + (error as Error).message }, { status: 500 });
  }
}

function buildZeroCounts() {
  return {
    total: 0, pending: 0, inProgress: 0, underTreatment: 0,
    awaitingResponse: 0, treated: 0, completed: 0, escalated: 0,
    forwarded: 0, overdue: 0, myLoad: 0,
  };
}

// ─── POST ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { department: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!user.departmentId)
      return NextResponse.json({ error: "You must be assigned to a department first" }, { status: 400 });

    let body: any = {};
    let file: File | null = null;
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) {
        if (k === "document" && v instanceof File) file = v;
        else body[k] = v;
      }
    } else {
      body = await request.json();
    }

    const {
      title, description, assignedToId, priority = "MEDIUM",
      dueDate, caseReference, notes, office,
      isPaymentRequest, paymentRouting, paymentRecipientId,
      paymentRecipientIds,
    } = body;

    if (!title?.trim() || !description?.trim())
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });

    const isPayment = isPaymentRequest === true || isPaymentRequest === "true";

    // ── Resolve primary assignee ──────────────────────────────────────
    let primaryAssigneeId: string | null = null;

    if (isPayment) {
      if (paymentRouting === "DIRECTOR") {
        const finDir = await getFinanceDirector();
        primaryAssigneeId = finDir?.id || null;
        if (!primaryAssigneeId) {
          const fallback = await prisma.user.findFirst({
            where: { isActive: true, department: { name: { contains: "finance", mode: "insensitive" } } },
            select: { id: true },
          });
          primaryAssigneeId = fallback?.id || null;
        }
      } else if (paymentRouting === "SPECIFIC" && paymentRecipientId) {
        primaryAssigneeId = paymentRecipientId;
      } else if (paymentRouting === "ALL_FINANCE") {
        const finDir = await getFinanceDirector();
        primaryAssigneeId = finDir?.id || null;
      } else if (paymentRouting === "SELECTED_STAFF" || paymentRouting === "MULTI_FINANCE") {
        const ids: string[] = Array.isArray(paymentRecipientIds)
          ? paymentRecipientIds
          : typeof paymentRecipientIds === "string"
            ? JSON.parse(paymentRecipientIds)
            : [];
        primaryAssigneeId = ids[0] || null;
      }
    } else {
      if (!assignedToId || assignedToId === "SELF" || assignedToId === user.id) {
        primaryAssigneeId = user.id;
      } else {
        const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!assignee) return NextResponse.json({ error: "Assigned user not found" }, { status: 404 });
        primaryAssigneeId = assignedToId;
      }
    }

    // ── Handle document ───────────────────────────────────────────────
    let documentData: string | null = null;
    let documentName: string | null = null;
    let documentType: string | null = null;
    let documentSize: number | null = null;
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      documentData = Buffer.from(bytes).toString("base64");
      documentName = file.name;
      documentType = file.type;
      documentSize = file.size;
    }

    const taskRef    = await generateTaskRef();
    const taskSource = !primaryAssigneeId || primaryAssigneeId === user.id
      ? "SELF"
      : user.role === "EXECUTIVE" ? "EVC" : "DEPARTMENT";

    const task = await prisma.task.create({
      data: {
        taskRef,
        title:              title.trim(),
        description:        description.trim(),
        departmentId:       user.departmentId,
        createdById:        user.id,
        assignedToId:       primaryAssigneeId,
        priority,
        dueDate:            dueDate ? new Date(dueDate) : null,
        caseReference:      caseReference?.trim() || null,
        notes:              notes?.trim() || null,
        office:             office?.trim() || null,
        isPaymentRequest:   isPayment,
        paymentRouting:     paymentRouting || null,
        paymentRecipientId: paymentRecipientId || null,
        taskSource,
        documentData,
        documentName,
        documentType,
        documentSize,
        status:          "PENDING",
        treatmentStatus: "PENDING",
      },
      include: taskIncludes,
    });

    // ── Send notifications ────────────────────────────────────────────
    const docNote  = documentName ? ` 📎 ${documentName}` : "";
    const dateNote = dueDate ? ` Due: ${new Date(dueDate).toLocaleDateString("en-GB")}.` : "";

    if (isPayment) {
      const notifTitle = `💳 Payment request: ${taskRef}`;
      const notifMsg   = `${user.name} (${user.department?.name || "unknown dept"}) sent a payment confirmation request: "${title.trim()}".${dateNote}${docNote}`;

      let recipientIds: string[] = [];

      if (paymentRouting === "DIRECTOR") {
        if (primaryAssigneeId) recipientIds = [primaryAssigneeId];
      } else if (paymentRouting === "ALL_FINANCE") {
        const allFinance = await getFinanceStaff();
        recipientIds = allFinance.map(s => s.id);
      } else if (paymentRouting === "SPECIFIC") {
        if (paymentRecipientId) recipientIds = [paymentRecipientId];
      } else if (paymentRouting === "SELECTED_STAFF" || paymentRouting === "MULTI_FINANCE") {
        const ids: string[] = Array.isArray(paymentRecipientIds)
          ? paymentRecipientIds
          : typeof paymentRecipientIds === "string"
            ? JSON.parse(paymentRecipientIds)
            : [];
        recipientIds = ids;
      }

      const uniqueRecipients = [...new Set(recipientIds)].filter(id => id !== user.id);

      if (uniqueRecipients.length === 0) {
        const fallbackFinance = await getFinanceStaff([user.id]);
        for (const fs of fallbackFinance) {
          await prisma.notification.create({
            data: { userId: fs.id, title: notifTitle, message: `${notifMsg} (No specific routing found — broadcast to Finance)`, type: "INFO", link: "/tasks" },
          });
        }
      } else {
        await prisma.notification.createMany({
          data: uniqueRecipients.map(uid => ({
            userId:  uid,
            title:   notifTitle,
            message: notifMsg,
            type:    "INFO" as const,
            link:    "/tasks",
          })),
          skipDuplicates: true,
        });
      }

      // Confirm to sender
      await prisma.notification.create({
        data: {
          userId:  user.id,
          title:   `✅ Payment request submitted: ${taskRef}`,
          message: `Your payment request "${title.trim()}" has been sent to Finance.${dateNote}`,
          type:    "SUCCESS",
          link:    "/tasks",
        },
      });

    } else {
      // Normal task — notify assignee
      if (primaryAssigneeId && primaryAssigneeId !== user.id) {
        await prisma.notification.create({
          data: {
            userId:  primaryAssigneeId,
            title:   `New task assigned: ${taskRef}`,
            message: `${user.name} assigned you: "${title.trim()}".${dateNote}`,
            type:    "INFO",
            link:    "/tasks",
          },
        });
      }
      // ── NEW: Also notify dept head/director when any staff creates a task ──
      // So the head can see it in department view + gets a heads-up
      if (user.departmentId && primaryAssigneeId === user.id) {
        const deptDirector = await prisma.user.findFirst({
          where: { departmentId: user.departmentId, role: "DIRECTOR", id: { not: user.id } },
        });
        if (deptDirector) {
          await prisma.notification.create({
            data: {
              userId:  deptDirector.id,
              title:   `📋 New self-task: ${taskRef}`,
              message: `${user.name} created a self-task: "${title.trim()}".${dateNote} Visible in your department view.`,
              type:    "INFO",
              link:    "/tasks?view=department",
            },
          });
        }
      }
    }

    // ── Auto-notify Director when assignee hits 10 active tasks ──────
    let loadWarning = "";
    const targetId = primaryAssigneeId;
    if (targetId && targetId !== user.id) {
      const activeCount = await prisma.task.count({
        where: { assignedToId: targetId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      });
      if (activeCount >= 10) {
        loadWarning = `This person now has ${activeCount} active tasks. Consider redistributing workload.`;
        const assigneeUser = await prisma.user.findUnique({
          where: { id: targetId },
          select: { name: true, departmentId: true },
        });
        if (assigneeUser?.departmentId) {
          const director = await prisma.user.findFirst({
            where: { departmentId: assigneeUser.departmentId, role: "DIRECTOR" },
          });
          if (director && director.id !== user.id) {
            const recentWarn = await prisma.notification.findFirst({
              where: {
                userId:  director.id,
                message: { contains: assigneeUser.name },
                createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
              },
            });
            if (!recentWarn) {
              await prisma.notification.create({
                data: {
                  userId:  director.id,
                  title:   `⚠ Heavy workload alert`,
                  message: `${assigneeUser.name} now has ${activeCount} active tasks. Consider using the Load Balancer to redistribute.`,
                  type:    "WARNING",
                  link:    "/task-load-balancer",
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, task, loadWarning }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const {
      taskId, action, status, treatmentStatus, directorComment,
      forwardToId, forwardNote, escalationReason,
      transferToId, transferNote, assignedToId,
    } = body;

    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

    const existing = await prisma.task.findUnique({
      where:   { id: taskId },
      include: { assignedTo: true, createdBy: true },
    });
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canUpdate =
      existing.assignedToId  === user.id ||
      existing.createdById   === user.id ||
      existing.forwardedToId === user.id ||
      ["DIRECTOR", "ADMIN", "EXECUTIVE"].includes(user.role);

    if (!canUpdate) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    // ── TRANSFER ─────────────────────────────────────────────────────
    if (action === "transfer") {
      if (!transferToId) return NextResponse.json({ error: "transferToId required" }, { status: 400 });
      const recipient = await prisma.user.findUnique({ where: { id: transferToId } });
      if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

      const noteEntry = `[Transfer by ${user.name} on ${new Date().toLocaleString()}] ${transferNote || "No reason provided"}`;
      await prisma.task.update({
        where: { id: taskId },
        data: {
          assignedToId: transferToId,
          notes: existing.notes ? `${existing.notes}\n\n${noteEntry}` : noteEntry,
        },
      });
      await prisma.notification.create({
        data: {
          userId:  transferToId,
          title:   `Task transferred to you: ${existing.taskRef || existing.title}`,
          message: `${user.name} transferred task "${existing.title}" to you.${transferNote ? ` Note: ${transferNote}` : ""}`,
          type:    "INFO",
          link:    "/tasks",
        },
      });
      if (existing.assignedToId && existing.assignedToId !== user.id && existing.assignedToId !== transferToId) {
        await prisma.notification.create({
          data: {
            userId:  existing.assignedToId,
            title:   "Task transferred away",
            message: `Task "${existing.title}" was transferred to ${recipient.name} by ${user.name}.`,
            type:    "INFO",
            link:    "/tasks",
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "TASK_TRANSFERRED",
          detail: `[${existing.taskRef}] transferred to ${recipient.name}. Note: ${transferNote || "None"}`,
        },
      });
      return NextResponse.json({ success: true });
    }

    // ── REASSIGN (load balancer) ──────────────────────────────────────
    if (action === "reassign") {
      if (!assignedToId) return NextResponse.json({ error: "assignedToId required" }, { status: 400 });
      const newAssignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!newAssignee) return NextResponse.json({ error: "Assigned user not found" }, { status: 404 });
      const noteEntry = `[Reassigned to ${newAssignee.name} by ${user.name} on ${new Date().toLocaleString()}]`;
      await prisma.task.update({
        where: { id: taskId },
        data: {
          assignedToId,
          notes: existing.notes ? `${existing.notes}\n\n${noteEntry}` : noteEntry,
        },
      });
      await prisma.notification.create({
        data: {
          userId:  assignedToId,
          title:   `Task assigned: ${existing.taskRef || existing.title}`,
          message: `${user.name} assigned task "${existing.title}" to you.`,
          type:    "INFO",
          link:    "/tasks",
        },
      });
      return NextResponse.json({ success: true });
    }

    // ── FORWARD ───────────────────────────────────────────────────────
    if (action === "forward") {
      if (!forwardToId) return NextResponse.json({ error: "forwardToId required" }, { status: 400 });
      const recipient = await prisma.user.findUnique({ where: { id: forwardToId } });
      if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

      const forwardedTask = await prisma.task.create({
        data: {
          taskRef:         await generateTaskRef(),
          title:           `FWD: ${existing.title}`,
          description:     `${forwardNote || "Forwarded without note"}\n\n--- Original task ---\n${existing.description}`,
          departmentId:    existing.departmentId,
          createdById:     existing.createdById,
          assignedToId:    forwardToId,
          forwardedFromId: user.id,
          forwardedToId:   forwardToId,
          forwardNote:     forwardNote || null,
          priority:        existing.priority,
          dueDate:         existing.dueDate,
          caseReference:   existing.caseReference,
          notes:           existing.notes,
          office:          existing.office,
          status:          "PENDING",
          treatmentStatus: "FORWARDED",
          taskSource:      "TRANSFERRED",
          documentData:    existing.documentData,
          documentName:    existing.documentName,
          documentType:    existing.documentType,
          documentSize:    existing.documentSize,
        },
      });

      await prisma.task.update({
        where: { id: taskId },
        data:  { treatmentStatus: "FORWARDED", forwardedToId: forwardToId },
      });

      await prisma.notification.create({
        data: {
          userId:  forwardToId,
          title:   `Task forwarded to you: ${existing.taskRef}`,
          message: `${user.name} forwarded "${existing.title}" to you.${forwardNote ? ` Note: ${forwardNote}` : ""}${existing.documentName ? ` 📎 Includes: ${existing.documentName}` : ""}`,
          type:    "INFO",
          link:    "/tasks",
        },
      });

      return NextResponse.json({ success: true, forwardedTask });
    }

    // ── ESCALATE ─────────────────────────────────────────────────────
    if (action === "escalate") {
      if (!escalationReason) return NextResponse.json({ error: "Escalation reason required" }, { status: 400 });
      await prisma.task.update({
        where: { id: taskId },
        data:  { treatmentStatus: "ESCALATED", escalationReason, escalatedAt: new Date() },
      });
      if (existing.departmentId) {
        const director = await prisma.user.findFirst({
          where: { departmentId: existing.departmentId, role: "DIRECTOR" },
        });
        if (director) {
          await prisma.notification.create({
            data: {
              userId:  director.id,
              title:   "🔺 Task escalated",
              message: `${user.name} escalated "${existing.title}" [${existing.taskRef}]. Reason: ${escalationReason}`,
              type:    "ALERT",
              link:    "/tasks",
            },
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    // ── STATUS / TREATMENT UPDATE ─────────────────────────────────────
    const updateData: any = {};
    if (status) {
      const allowed = ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"];
      if (!allowed.includes(status))
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      updateData.status = status;
      if (status === "COMPLETED") updateData.completedAt = new Date();
    }
    if (treatmentStatus)               updateData.treatmentStatus = treatmentStatus;
    if (directorComment !== undefined) updateData.directorComment = directorComment;

    if (Object.keys(updateData).length === 0)
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    await prisma.task.update({ where: { id: taskId }, data: updateData });

    if (status === "COMPLETED" && existing.createdById !== user.id) {
      await prisma.notification.create({
        data: {
          userId:  existing.createdById,
          title:   "✅ Task completed",
          message: `${user.name} marked "${existing.title}" [${existing.taskRef}] as completed.`,
          type:    "SUCCESS",
          link:    "/tasks",
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/tasks error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("id");
    if (!taskId) return NextResponse.json({ error: "id required" }, { status: 400 });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canDelete = task.createdById === user.id || ["DIRECTOR", "ADMIN"].includes(user.role);
    if (!canDelete) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    await prisma.task.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tasks error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}