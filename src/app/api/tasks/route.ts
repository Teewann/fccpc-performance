import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateRefNo } from "@/lib/refNo";

function buildZeroCounts() {
  return {
    total: 0, pending: 0, inProgress: 0, underTreatment: 0,
    awaitingResponse: 0, treated: 0, completed: 0, escalated: 0,
    forwarded: 0, overdue: 0, myLoad: 0,
  };
}

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

// Combines a base where-clause with an extra condition without clobbering
// either — used to compute accurate counts against the FULL filtered set,
// not just whatever page happens to be loaded.
function mergeWhere(base: any, extra: any) {
  return { AND: [base, extra] };
}

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

// Computes the visibility condition for a given view + user, reusing the
// exact same permission logic for every caller — including the new
// all-tabs-at-once counts below, so those counts can never drift out of
// sync with what a tab's own fetch would actually return.
function buildViewCondition(view: string, user: { id: string; role: string; departmentId: string | null }) {
  const isAdmin = user.role === "ADMIN";
  const isExecutive = user.role === "EXECUTIVE";
  const isDirector = user.role === "DIRECTOR";
  const isSupervisor = user.role === "SUPERVISOR";

  if (view === "assigned") {
    return { OR: [{ assignedToId: user.id }, { forwardedToId: user.id }] };
  }
  if (view === "created") {
    return { createdById: user.id };
  }
  if (view === "department") {
    if (!user.departmentId) return { id: "__none__" }; // no department = no results, not an error here
    if (isDirector || isSupervisor) return { departmentId: user.departmentId };
    return { OR: [{ assignedToId: user.id }, { createdById: user.id }] };
  }
  if (view === "all") {
    if (isAdmin || isExecutive) return {};
    if (isDirector || isSupervisor) {
      return user.departmentId ? { departmentId: user.departmentId } : { createdById: user.id };
    }
    return {
      OR: [{ assignedToId: user.id }, { forwardedToId: user.id }, { createdById: user.id }],
    };
  }
  return { OR: [{ assignedToId: user.id }, { createdById: user.id }, { forwardedToId: user.id }] };
}

// ─── GET ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    if (searchParams.get("financeStaff") === "1") {
      const staff = await getFinanceStaff();
      return NextResponse.json({ financeStaff: staff });
    }

    const isAdmin = user.role === "ADMIN";
    const isExecutive = user.role === "EXECUTIVE";
    const isDirector = user.role === "DIRECTOR";
    const isSupervisor = user.role === "SUPERVISOR";
    const isHR = user.role === "HR";
    const isPrivileged = isAdmin || isExecutive || isDirector || isSupervisor || isHR;

    let viewCondition: any = {};

    if (targetUserId && (isAdmin || isExecutive || isDirector)) {
      viewCondition = { assignedToId: targetUserId };
    } else if (view === "assigned") {
      viewCondition = {
        OR: [{ assignedToId: user.id }, { forwardedToId: user.id }],
      };
    } else if (view === "created") {
      viewCondition = { createdById: user.id };
    } else if (view === "department") {
      if (!user.departmentId) {
        return NextResponse.json({ tasks: [], counts: buildZeroCounts(), loadWarning: "", total: 0, page: 1, pages: 0 });
      }
      if (isDirector || isSupervisor) {
        viewCondition = { departmentId: user.departmentId };
      } else {
        viewCondition = { OR: [{ assignedToId: user.id }, { createdById: user.id }] };
      }
    } else if (view === "all") {
      if (isAdmin || isExecutive) {
        viewCondition = {};
      } else if (isDirector || isSupervisor) {
        viewCondition = user.departmentId ? { departmentId: user.departmentId } : { createdById: user.id };
      } else {
        // FIX: plain staff previously also matched on departmentId here,
        // which leaked every task in the department (including other
        // people's payment requests and EVC-sourced tasks) to junior staff
        // the moment they clicked "All". Staff now see only what they're
        // actually party to, same as every other view.
        viewCondition = {
          OR: [
            { assignedToId: user.id },
            { forwardedToId: user.id },
            { createdById: user.id },
          ],
        };
      }
    } else {
      viewCondition = {
        OR: [{ assignedToId: user.id }, { createdById: user.id }, { forwardedToId: user.id }],
      };
    }

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
    const now = new Date();

    // FIX: counts are now computed with real aggregate queries against the
    // FULL filtered set, not derived from whatever page happens to be
    // loaded. Previously "Total", "Pending", "Completed" etc. on the
    // dashboard were silently wrong for any department with more than one
    // page of tasks — they only reflected the current page's 20 rows.
    const [
      tasks,
      total,
      pending,
      inProgress,
      underTreatment,
      awaitingResponse,
      treated,
      completed,
      escalated,
      forwarded,
      overdue,
      myLoad,
    ] = await Promise.all([
      prisma.task.findMany({
        where: whereClause,
        include: {
          department: { select: { name: true } },
          assignedTo: { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
          createdBy: { select: { id: true, name: true, role: true } },
          forwardedTo: { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
          forwardedFrom: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.task.count({ where: whereClause }),
      prisma.task.count({ where: mergeWhere(whereClause, { status: "PENDING" }) }),
      prisma.task.count({ where: mergeWhere(whereClause, { status: "IN_PROGRESS" }) }),
      prisma.task.count({ where: mergeWhere(whereClause, { treatmentStatus: "UNDER_TREATMENT" }) }),
      prisma.task.count({ where: mergeWhere(whereClause, { treatmentStatus: "AWAITING_RESPONSE" }) }),
      prisma.task.count({ where: mergeWhere(whereClause, { treatmentStatus: "TREATED" }) }),
      prisma.task.count({ where: mergeWhere(whereClause, { status: "COMPLETED" }) }),
      prisma.task.count({ where: mergeWhere(whereClause, { treatmentStatus: "ESCALATED" }) }),
      prisma.task.count({
        where: mergeWhere(whereClause, { OR: [{ treatmentStatus: "FORWARDED" }, { forwardedToId: { not: null } }] }),
      }),
      prisma.task.count({
        where: mergeWhere(whereClause, { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } }),
      }),
      prisma.task.count({
        where: { OR: [{ assignedToId: user.id }, { forwardedToId: user.id }], status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
    ]);

    const sortedTasks = [
      ...tasks.filter((t) => (t as any).taskSource === "EVC"),
      ...tasks.filter((t) => (t as any).taskSource !== "EVC"),
    ];

    let loadWarning = "";
    if (myLoad >= 15) loadWarning = `Critical load: ${myLoad} active tasks. Consider delegating.`;
    else if (myLoad >= 10) loadWarning = `You have ${myLoad} active tasks. Prioritise carefully.`;

    const counts = {
      total, pending, inProgress, underTreatment, awaitingResponse,
      treated, completed, escalated, forwarded, overdue, myLoad,
    };

    // NEW — real counts for all four view tabs at once, using the exact
    // same permission logic as the main query, so the tab badges always
    // show accurate numbers regardless of which tab is currently active
    // (previously the inactive tabs just showed "-" because the app had
    // no way to know their counts without a separate fetch).
    const [assignedCount, createdCount, departmentCount, allCount] = await Promise.all([
      prisma.task.count({ where: buildViewCondition("assigned", user) }),
      prisma.task.count({ where: buildViewCondition("created", user) }),
      prisma.task.count({ where: buildViewCondition("department", user) }),
      prisma.task.count({ where: buildViewCondition("all", user) }),
    ]);
    const viewCounts = { assigned: assignedCount, created: createdCount, department: departmentCount, all: allCount };

    return NextResponse.json({
      tasks: sortedTasks,
      counts,
      viewCounts,
      loadWarning,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "Server error: " + (error as Error).message }, { status: 500 });
  }
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

    const taskRef = await generateTaskRef();
    const taskSource = !primaryAssigneeId || primaryAssigneeId === user.id
      ? "SELF"
      : user.role === "EXECUTIVE" ? "EVC" : "DEPARTMENT";

    const task = await prisma.task.create({
      data: {
        taskRef,
        title: title.trim(),
        description: description.trim(),
        departmentId: user.departmentId,
        createdById: user.id,
        assignedToId: primaryAssigneeId,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        caseReference: caseReference?.trim() || null,
        notes: notes?.trim() || null,
        office: office?.trim() || null,
        isPaymentRequest: isPayment,
        paymentRouting: paymentRouting || null,
        paymentRecipientId: paymentRecipientId || null,
        taskSource,
        documentData,
        documentName,
        documentType,
        documentSize,
        status: "PENDING",
        treatmentStatus: "PENDING",
      },
      include: {
        department: { select: { name: true } },
        assignedTo: { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
        createdBy: { select: { id: true, name: true, role: true } },
        forwardedTo: { select: { id: true, name: true, role: true, department: { select: { name: true } } } },
        forwardedFrom: { select: { id: true, name: true, role: true } },
      },
    });

    const docNote = documentName ? ` 📎 ${documentName}` : "";
    const dateNote = dueDate ? ` Due: ${new Date(dueDate).toLocaleDateString("en-GB")}.` : "";

    if (isPayment) {
      const notifTitle = `Payment request: ${taskRef}`;
      const notifMsg = `${user.name} (${user.department?.name || "unknown dept"}) sent a payment confirmation request: "${title.trim()}".${dateNote}${docNote}`;

      let recipientIds: string[] = [];
      if (paymentRouting === "DIRECTOR") {
        if (primaryAssigneeId) recipientIds = [primaryAssigneeId];
      } else if (paymentRouting === "ALL_FINANCE") {
        const allFinance = await getFinanceStaff();
        recipientIds = allFinance.map((s) => s.id);
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

      const uniqueRecipients = [...new Set(recipientIds)].filter((id) => id !== user.id);

      if (uniqueRecipients.length === 0) {
        const fallbackFinance = await getFinanceStaff([user.id]);
        for (const fs of fallbackFinance) {
          await prisma.notification.create({
            data: { userId: fs.id, title: notifTitle, message: `${notifMsg} (No specific routing found — broadcast to Finance)`, type: "INFO", link: "/tasks" },
          });
        }
      } else {
        await prisma.notification.createMany({
          data: uniqueRecipients.map((uid) => ({
            userId: uid, title: notifTitle, message: notifMsg, type: "INFO" as const, link: "/tasks",
          })),
          skipDuplicates: true,
        });
      }

      await prisma.notification.create({
        data: {
          userId: user.id,
          title: `Payment request submitted: ${taskRef}`,
          message: `Your payment request "${title.trim()}" has been sent to Finance.${dateNote}`,
          type: "SUCCESS",
          link: "/tasks",
        },
      });
    } else {
      if (primaryAssigneeId && primaryAssigneeId !== user.id) {
        await prisma.notification.create({
          data: {
            userId: primaryAssigneeId,
            title: `New task assigned: ${taskRef}`,
            message: `${user.name} assigned you: "${title.trim()}".${dateNote}`,
            type: "INFO",
            link: "/tasks",
          },
        });
      }
      if (user.departmentId && primaryAssigneeId === user.id) {
        const deptDirector = await prisma.user.findFirst({
          where: { departmentId: user.departmentId, role: "DIRECTOR", id: { not: user.id } },
        });
        if (deptDirector) {
          await prisma.notification.create({
            data: {
              userId: deptDirector.id,
              title: `New self-task: ${taskRef}`,
              message: `${user.name} created a self-task: "${title.trim()}".${dateNote} Visible in your department view.`,
              type: "INFO",
              link: "/tasks?view=department",
            },
          });
        }
      }
    }

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
                userId: director.id,
                message: { contains: assigneeUser.name },
                createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
              },
            });
            if (!recentWarn) {
              await prisma.notification.create({
                data: {
                  userId: director.id,
                  title: `Heavy workload alert`,
                  message: `${assigneeUser.name} now has ${activeCount} active tasks. Consider using the Load Balancer to redistribute.`,
                  type: "WARNING",
                  link: "/task-load-balancer",
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
      where: { id: taskId },
      include: { assignedTo: true, createdBy: true },
    });
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canUpdate =
      existing.assignedToId === user.id ||
      existing.createdById === user.id ||
      existing.forwardedToId === user.id ||
      ["DIRECTOR", "ADMIN", "EXECUTIVE"].includes(user.role);

    if (!canUpdate) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

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
          userId: transferToId,
          title: `Task transferred to you: ${existing.taskRef || existing.title}`,
          message: `${user.name} transferred task "${existing.title}" to you.${transferNote ? ` Note: ${transferNote}` : ""}`,
          type: "INFO",
          link: "/tasks",
        },
      });
      if (existing.assignedToId && existing.assignedToId !== user.id && existing.assignedToId !== transferToId) {
        await prisma.notification.create({
          data: {
            userId: existing.assignedToId,
            title: "Task transferred away",
            message: `Task "${existing.title}" was transferred to ${recipient.name} by ${user.name}.`,
            type: "INFO",
            link: "/tasks",
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
          userId: assignedToId,
          title: `Task assigned: ${existing.taskRef || existing.title}`,
          message: `${user.name} assigned task "${existing.title}" to you.`,
          type: "INFO",
          link: "/tasks",
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "forward") {
      if (!forwardToId) return NextResponse.json({ error: "forwardToId required" }, { status: 400 });
      const recipient = await prisma.user.findUnique({ where: { id: forwardToId } });
      if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

      const forwardedTask = await prisma.task.create({
        data: {
          taskRef: await generateTaskRef(),
          title: `FWD: ${existing.title}`,
          description: `${forwardNote || "Forwarded without note"}\n\n--- Original task ---\n${existing.description}`,
          departmentId: existing.departmentId,
          createdById: existing.createdById,
          assignedToId: forwardToId,
          forwardedFromId: user.id,
          forwardedToId: forwardToId,
          forwardNote: forwardNote || null,
          priority: existing.priority,
          dueDate: existing.dueDate,
          caseReference: existing.caseReference,
          notes: existing.notes,
          office: existing.office,
          status: "PENDING",
          treatmentStatus: "FORWARDED",
          taskSource: "TRANSFERRED",
          documentData: existing.documentData,
          documentName: existing.documentName,
          documentType: existing.documentType,
          documentSize: existing.documentSize,
        },
      });

      await prisma.task.update({
        where: { id: taskId },
        data: { treatmentStatus: "FORWARDED", forwardedToId: forwardToId },
      });

      await prisma.notification.create({
        data: {
          userId: forwardToId,
          title: `Task forwarded to you: ${existing.taskRef}`,
          message: `${user.name} forwarded "${existing.title}" to you.${forwardNote ? ` Note: ${forwardNote}` : ""}${existing.documentName ? ` 📎 Includes: ${existing.documentName}` : ""}`,
          type: "INFO",
          link: "/tasks",
        },
      });

      return NextResponse.json({ success: true, forwardedTask });
    }

    if (action === "escalate") {
      if (!escalationReason) return NextResponse.json({ error: "Escalation reason required" }, { status: 400 });
      await prisma.task.update({
        where: { id: taskId },
        data: { treatmentStatus: "ESCALATED", escalationReason, escalatedAt: new Date() },
      });
      if (existing.departmentId) {
        const director = await prisma.user.findFirst({
          where: { departmentId: existing.departmentId, role: "DIRECTOR" },
        });
        if (director) {
          await prisma.notification.create({
            data: {
              userId: director.id,
              title: "Task escalated",
              message: `${user.name} escalated "${existing.title}" [${existing.taskRef}]. Reason: ${escalationReason}`,
              type: "ALERT",
              link: "/tasks",
            },
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    const updateData: any = {};
    if (status) {
      const allowed = ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"];
      if (!allowed.includes(status))
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      updateData.status = status;
      if (status === "COMPLETED") updateData.completedAt = new Date();
    }
    if (treatmentStatus) {
      // FIX: treatmentStatus previously accepted any arbitrary string with
      // no validation, unlike status. An unrecognized value would silently
      // fall back to the default "Pending" styling in the UI with no error
      // telling anyone why.
      const allowedTreatment = [
        "PENDING", "ACKNOWLEDGED", "UNDER_TREATMENT", "AWAITING_RESPONSE",
        "TREATED", "ESCALATED", "FORWARDED", "COMPLETED", "CANCELLED",
      ];
      if (!allowedTreatment.includes(treatmentStatus)) {
        return NextResponse.json({ error: "Invalid treatment status value" }, { status: 400 });
      }
      updateData.treatmentStatus = treatmentStatus;
    }
    if (directorComment !== undefined) updateData.directorComment = directorComment;

    if (Object.keys(updateData).length === 0)
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    await prisma.task.update({ where: { id: taskId }, data: updateData });

    if (status === "COMPLETED" && existing.createdById !== user.id) {
      await prisma.notification.create({
        data: {
          userId: existing.createdById,
          title: "Task completed",
          message: `${user.name} marked "${existing.title}" [${existing.taskRef}] as completed.`,
          type: "SUCCESS",
          link: "/tasks",
        },
      });
    }

    // NEW — close the loop between Tasks and the Performance Index: a
    // completed task now automatically counts as logged work for whoever
    // did it, without them needing to separately fill out a Daily Log.
    // Tagged clearly as auto-generated so a reviewing supervisor knows
    // what they're scoring, and linked back to the source task via taskId.
    if (status === "COMPLETED") {
      const completerId = existing.assignedToId || user.id;
      try {
        await prisma.dailyLog.create({
          data: {
            refNo: generateRefNo("DL"),
            userId: completerId,
            taskId: existing.id,
            taskTitle: existing.title,
            taskCategory: "Task completion",
            description: `Auto-logged on completion of task ${existing.taskRef || existing.id}: ${existing.title}`,
            timeSpent: 1,
            priority: existing.priority,
            status: "SUBMITTED",
            notes: "Auto-generated when this task was marked complete — edit the time spent for accuracy if needed.",
          },
        });
      } catch (logErr) {
        // Never let a Daily Log write failure block the actual task
        // completion — log it and move on rather than surfacing a 500
        // for something that already succeeded from the user's perspective.
        console.error("Auto-log-on-completion failed (task still completed):", logErr);
      }
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