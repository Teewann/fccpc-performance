import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// ─── GET — EVC sees all tasks they created + grouped staff list ───────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tasks = await prisma.eVCTask.findMany({
      where: { createdById: user.id },
      include: {
        assignedTo: {
          select: {
            name: true, role: true, email: true,
            department: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const allStaff = await prisma.user.findMany({
      where: { isActive: true, role: { not: "INTERN" } },
      select: {
        id: true, name: true, role: true, staffId: true,
        department: { select: { name: true } },
        unit:       { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const groupedStaff = allStaff.reduce(
      (acc: Record<string, typeof allStaff>, person) => {
        const label =
          person.role === "EXECUTIVE"  ? "Executives"     :
          person.role === "DIRECTOR"   ? "Directors"      :
          person.role === "HR"         ? "HR Officers"    :
          person.role === "SUPERVISOR" ? "Supervisors"    :
          person.role === "ADMIN"      ? "Administrators" : "Staff";
        if (!acc[label]) acc[label] = [];
        acc[label].push(person);
        return acc;
      },
      {}
    );

    return NextResponse.json({ tasks, groupedStaff, allStaff });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST — EVC assigns a task (with optional document) ──────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user || user.role !== "EXECUTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let title = "", description = "", assignedToId = "";
    let priority = "HIGH", category = "General";
    let dueDate = "", notes = "";
    let isConfidential = false;
    let documentData: string | null = null;
    let documentName: string | null = null;
    let documentType: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const fd     = await request.formData();
      title        = (fd.get("title")        as string) || "";
      description  = (fd.get("description")  as string) || "";
      assignedToId = (fd.get("assignedToId") as string) || "";
      priority     = (fd.get("priority")     as string) || "HIGH";
      category     = (fd.get("category")     as string) || "General";
      dueDate      = (fd.get("dueDate")      as string) || "";
      notes        = (fd.get("notes")        as string) || "";
      isConfidential = fd.get("isConfidential") === "true";

      const file = fd.get("document") as File | null;
      if (file && file.size > 0) {
        const bytes  = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        documentData = `data:${file.type};base64,${buffer.toString("base64")}`;
        documentName = file.name;
        documentType = file.type;
      }
    } else {
      const body   = await request.json();
      title        = body.title        || "";
      description  = body.description  || "";
      assignedToId = body.assignedToId || "";
      priority     = body.priority     || "HIGH";
      category     = body.category     || "General";
      dueDate      = body.dueDate      || "";
      notes        = body.notes        || "";
      isConfidential = body.isConfidential || false;
    }

    if (!title.trim() || !description.trim() || !assignedToId) {
      return NextResponse.json(
        { error: "Title, description and assignee are required" },
        { status: 400 }
      );
    }

    const assignee = await prisma.user.findUnique({
      where:  { id: assignedToId },
      select: { name: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "Assigned user not found" }, { status: 404 });
    }

    const task = await prisma.eVCTask.create({
      data: {
        title:          title.trim(),
        description:    description.trim(),
        assignedToId,
        createdById:    user.id,
        priority,
        status:         "PENDING",
        category,
        isConfidential,
        dueDate:        dueDate ? new Date(dueDate) : null,
        notes:          notes.trim() || null,
        documentData,
        documentName,
        documentType,
      },
      include: {
        assignedTo: {
          select: { name: true, role: true, department: { select: { name: true } } },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId:  assignedToId,
        title:   "Directive from the EVC",
        message: `The Executive Vice Chairman has assigned you a task: "${title}".${
          isConfidential ? " This task is marked CONFIDENTIAL." : ""
        }${dueDate ? ` Due: ${new Date(dueDate).toLocaleDateString("en-GB")}.` : ""} Go to EVC Directives to view and respond.`,
        type: "ALERT",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EVC_TASK_ASSIGNED",
        detail: `EVC assigned task "${title}" to ${assignee.name}`,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error("EVC POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH — assignee OR EVC updates task status/comment ─────────────
// NO role restriction — any authenticated user who is the assignee
// or the EVC creator of a task can update it.
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

    // Only the assignee or the EVC who created it can update
    const isAssignee = task.assignedToId === user.id;
    const isCreator  = task.createdById  === user.id;

    if (!isAssignee && !isCreator) {
      return NextResponse.json(
        { error: "You are not authorised to update this task" },
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

    // Notify EVC when assignee reports progress
    if (isAssignee && !isCreator && status) {
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
    console.error("EVC PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}