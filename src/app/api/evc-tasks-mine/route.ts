import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── GET — fetch tasks assigned TO the current user by EVC ───────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tasks = await prisma.eVCTask.findMany({
      where: { assignedToId: user.id },
      include: {
        createdBy: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH — assignee updates their task status/adds a note ──────────
// This mirrors the PATCH in evc-tasks/route.ts so the UI can call
// either endpoint — whichever is more natural for the user-side page.
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { taskId, status, comment } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const task = await prisma.eVCTask.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Must be the assignee to use this endpoint
    if (task.assignedToId !== user.id) {
      return NextResponse.json(
        { error: "You are not assigned to this task" },
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === "COMPLETED") updateData.completedAt = new Date();
    }
    if (comment !== undefined) {
      updateData.evcComment = comment;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.eVCTask.update({
      where: { id: taskId },
      data:  updateData,
    });

    // Notify the EVC who created the task
    if (status) {
      const statusLabel =
        status === "COMPLETED"   ? "marked as completed ✓" :
        status === "IN_PROGRESS" ? "now in progress"        :
        status === "CANCELLED"   ? "cancelled"              : status;

      await prisma.notification.create({
        data: {
          userId:  task.createdById,
          title:   `Task update from ${user.name}`,
          message: `${user.name} has ${statusLabel} the task: "${task.title}".${
            comment ? ` Their note: "${comment}"` : ""
          }`,
          type: status === "COMPLETED" ? "SUCCESS" : "INFO",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EVC_TASK_UPDATED",
        detail: `Task "${task.title}" updated to ${status || "commented"} by ${user.name}`,
      },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error("EVC-mine PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
