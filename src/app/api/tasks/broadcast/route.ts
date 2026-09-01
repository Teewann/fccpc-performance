// src/app/api/tasks/broadcast/route.ts
//
// A Director/HOD creates ONE directive for the whole department. This
// spawns one real Task per active staff member in that department, each
// individually trackable, all linked back to a parent "master" record so
// progress can be shown as "12 of 18 completed" rather than one shared
// task nobody's specifically accountable for.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateRefNo } from "@/lib/refNo";

const BROADCAST_CAPABLE_ROLES = ["DIRECTOR", "ADMIN", "EXECUTIVE", "HR"];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!BROADCAST_CAPABLE_ROLES.includes(requester.role)) {
      return NextResponse.json({ error: "You don't have permission to broadcast a directive" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, departmentId, priority, dueDate, caseReference, notes } = body;

    if (!title || !description || !departmentId) {
      return NextResponse.json({ error: "Title, description, and department are required" }, { status: 400 });
    }

    // Directors can only broadcast to their own department — Admin/Executive/HR can target any.
    if (requester.role === "DIRECTOR" && requester.departmentId !== departmentId) {
      return NextResponse.json({ error: "You can only broadcast to your own department" }, { status: 403 });
    }

    const staff = await prisma.user.findMany({
      where: { departmentId, isActive: true },
      select: { id: true },
    });

    if (staff.length === 0) {
      return NextResponse.json({ error: "No active staff found in that department" }, { status: 400 });
    }

    const parentRef = await generateRefNo("TASK");
    const parent = await prisma.task.create({
      data: {
        title,
        description,
        departmentId,
        createdById: requester.id,
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        caseReference: caseReference || null,
        notes: notes || null,
        taskRef: parentRef,
        isBroadcastParent: true,
        taskSource: "DEPARTMENT_BROADCAST",
      },
    });

    // Spawn one real, individually-owned task per staff member.
    const children = await Promise.all(
      staff.map(async (s) => {
        const childRef = await generateRefNo("TASK");
        return prisma.task.create({
          data: {
            title,
            description,
            departmentId,
            createdById: requester.id,
            assignedToId: s.id,
            priority: priority || "MEDIUM",
            dueDate: dueDate ? new Date(dueDate) : null,
            caseReference: caseReference || null,
            notes: notes || null,
            taskRef: childRef,
            broadcastParentId: parent.id,
            taskSource: "DEPARTMENT_BROADCAST",
          },
        });
      })
    );

    await prisma.notification.createMany({
      data: staff.map((s) => ({
        userId: s.id,
        title: "New department directive",
        message: `${requester.name} sent a directive to the whole department: "${title}"`,
        type: "INFO",
        link: "/tasks",
      })),
    });

    await prisma.auditLog.create({
      data: {
        userId: requester.id,
        action: "DEPARTMENT_BROADCAST_CREATED",
        detail: `Broadcast "${title}" to ${children.length} staff in department ${departmentId}`,
      },
    });

    return NextResponse.json({ success: true, parentId: parent.id, spawnedCount: children.length }, { status: 201 });
  } catch (error) {
    console.error("Broadcast error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET — progress on a specific broadcast: "12 of 18 completed"
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    if (!parentId) {
      return NextResponse.json({ error: "parentId is required" }, { status: 400 });
    }

    const [parent, children] = await Promise.all([
      prisma.task.findUnique({ where: { id: parentId } }),
      prisma.task.findMany({
        where: { broadcastParentId: parentId },
        select: { id: true, status: true, assignedTo: { select: { id: true, name: true } } },
      }),
    ]);

    if (!parent) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    const completed = children.filter((c) => c.status === "COMPLETED").length;

    return NextResponse.json({
      title: parent.title,
      total: children.length,
      completed,
      children: children.map((c) => ({
        userId: c.assignedTo?.id,
        name: c.assignedTo?.name,
        status: c.status,
      })),
    });
  } catch (error) {
    console.error("Broadcast progress error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}