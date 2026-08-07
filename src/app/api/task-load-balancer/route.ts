import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, departmentId: true, name: true },
    });

    const allowedRoles = ["ADMIN", "EXECUTIVE", "DIRECTOR", "HR", "SUPERVISOR"];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden – insufficient role" }, { status: 403 });
    }

    // Directors and Supervisors see ONLY their own department
    // Admins, Executives, HR see everything
    const isDeptScoped = ["DIRECTOR", "SUPERVISOR"].includes(user.role);

    if (isDeptScoped && !user.departmentId) {
      return NextResponse.json(
        { error: "You are not assigned to a department. Ask an Admin to assign you first." },
        { status: 400 }
      );
    }

    const staffWhere: any = { isActive: true };
    if (isDeptScoped) {
      staffWhere.departmentId = user.departmentId;
    }

    const allStaff = await prisma.user.findMany({
      where: staffWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        staffId: true,
        photo: true,
        department: { select: { id: true, name: true } },
        unit: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    if (allStaff.length === 0) {
      return NextResponse.json({
        staffLoads: [],
        unassigned: [],
        _debug: isDeptScoped
          ? "No active staff in your department."
          : "No active staff found. Please set at least one user to isActive = true in User Management.",
      });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const staffLoads = await Promise.all(
      allStaff.map(async (staff) => {

        const [activeTasks, pendingTasks, overdueTasks, completedThisMonth] = await Promise.all([
          prisma.task.count({
            where: {
              assignedToId: staff.id,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          }),
          prisma.task.count({
            where: { assignedToId: staff.id, status: "PENDING" },
          }),
          prisma.task.count({
            where: {
              assignedToId: staff.id,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
              dueDate: { lt: now },
            },
          }),
          prisma.task.count({
            where: {
              assignedToId: staff.id,
              status: "COMPLETED",
              completedAt: { gte: monthStart },
            },
          }),
        ]);

        // Actual task list for the expand panel
        const tasks = await prisma.task.findMany({
          where: {
            assignedToId: staff.id,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          select: {
            id: true,
            taskRef: true,
            title: true,
            priority: true,
            status: true,
            dueDate: true,
          },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
          take: 20,
        });

        let loadLevel: "EMPTY" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        if (activeTasks === 0)       loadLevel = "EMPTY";
        else if (activeTasks <= 3)   loadLevel = "LOW";
        else if (activeTasks <= 7)   loadLevel = "MEDIUM";
        else if (activeTasks <= 11)  loadLevel = "HIGH";
        else                         loadLevel = "CRITICAL";

        const loadScore = Math.min(100, Math.round((activeTasks / 15) * 100));

        return {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          staffId: staff.staffId,
          photo: staff.photo ?? null,
          department: staff.department,
          unit: staff.unit,
          activeTasks,
          pendingTasks,
          overdueTasks,
          completedThisMonth,
          loadScore,
          loadLevel,
          tasks: tasks.map(t => ({
            ...t,
            isOverdue: t.dueDate ? t.dueDate < now : false,
          })),
        };
      })
    );

    // Unassigned tasks — scoped by dept for Directors/Supervisors
    const unassignedWhere: any = {
      assignedToId: null,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    };
    if (isDeptScoped) {
      unassignedWhere.departmentId = user.departmentId;
    }

    const unassigned = await prisma.task.findMany({
      where: unassignedWhere,
      select: {
        id: true,
        taskRef: true,
        title: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        department: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ staffLoads, unassigned });
  } catch (error) {
    console.error("Task load balancer GET error:", error);
    return NextResponse.json({ error: "Server error", details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, departmentId: true, name: true },
    });

    const allowedRoles = ["ADMIN", "EXECUTIVE", "DIRECTOR", "HR", "SUPERVISOR"];
    if (!user || !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { taskId, assignedToId, reason } = body;

    if (!taskId || !assignedToId) {
      return NextResponse.json({ error: "taskId and assignedToId are required" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignedTo: true, department: true },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // ── Department scope check for Directors and Supervisors ──────────
    // A Director/Supervisor can reassign a task if ANY of these is true:
    //   1. The task's own departmentId matches theirs (they own the task)
    //   2. The current assignee is in their department (task is on their staff)
    //   3. The new assignee is in their department (they are assigning TO their staff)
    // This covers tasks created by another dept but assigned to their team.
    if (["DIRECTOR", "SUPERVISOR"].includes(user.role)) {
      const taskBelongsToDept = task.departmentId === user.departmentId;

      // Check current assignee's department
      let currentAssigneeBelongsToDept = false;
      if (task.assignedToId) {
        const currentAssignee = await prisma.user.findUnique({
          where: { id: task.assignedToId },
          select: { departmentId: true },
        });
        currentAssigneeBelongsToDept = currentAssignee?.departmentId === user.departmentId;
      }

      // Check new assignee's department
      const newAssigneeRecord = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { departmentId: true },
      });
      const newAssigneeBelongsToDept = newAssigneeRecord?.departmentId === user.departmentId;

      if (!taskBelongsToDept && !currentAssigneeBelongsToDept && !newAssigneeBelongsToDept) {
        return NextResponse.json(
          { error: "You can only reassign tasks involving staff in your department" },
          { status: 403 }
        );
      }
    }

    const newAssignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!newAssignee) {
      return NextResponse.json({ error: "Target staff member not found" }, { status: 404 });
    }

    const prevAssignee = task.assignedTo;

    const noteEntry = `[Rebalanced by ${user.name} on ${new Date().toLocaleString()}] ${
      reason ? `Reason: ${reason}` : "Redistributed via Load Balancer."
    }`;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId,
        notes: task.notes ? `${task.notes}\n\n${noteEntry}` : noteEntry,
      },
    });

    // Notify new assignee
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        title: "📋 Task assigned to you",
        message: `${user.name} assigned task "${task.title}"${task.taskRef ? ` [${task.taskRef}]` : ""} to you.${
          reason ? ` Reason: ${reason}` : ""
        }`,
        type: "INFO",
        link: "/tasks",
      },
    });

    // Notify previous assignee if different
    if (prevAssignee && prevAssignee.id !== assignedToId) {
      await prisma.notification.create({
        data: {
          userId: prevAssignee.id,
          title: "📋 Task moved from your queue",
          message: `Task "${task.title}"${task.taskRef ? ` [${task.taskRef}]` : ""} was reassigned to ${newAssignee.name} by ${user.name}.${
            reason ? ` Reason: ${reason}` : ""
          }`,
          type: "WARNING",
          link: "/tasks",
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "TASK_REBALANCED",
        detail: `[${task.taskRef || task.id}] "${task.title}" reassigned from ${
          prevAssignee?.name || "unassigned"
        } to ${newAssignee.name} via Load Balancer. ${reason ? `Reason: ${reason}` : ""}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Load balancer POST error:", error);
    return NextResponse.json({ error: "Server error", details: String(error) }, { status: 500 });
  }
}
