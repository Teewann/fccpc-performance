// src/app/api/daily-logs/route.ts
//
// This is YOUR real route with additions layered in — every line of your
// original logic is preserved. Changes are marked with "// NEW".

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // REQUIRED — bare getServerSession() silently fails in the App Router
import { generateRefNo } from "@/lib/refNo";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();

    const {
      taskTitle,
      taskCategory,
      taskType,          // NEW — was collected client-side but never saved
      description,
      timeSpent,
      priority,
      status,
      caseReference,
      amountInvolved,
      notes,
      onBehalfOfUserId,  // NEW — proxy logging
      crossDepartment,   // NEW — from quick-capture AI flagging
    } = body;

    if (!taskTitle || !description || !timeSpent || !taskCategory) {
      return NextResponse.json(
        { error: "Task title, category, description and time spent are required" },
        { status: 400 }
      );
    }

    // NEW — proxy logging: figure out whose log this actually is, and verify
    // the requester is actually allowed to log for someone else.
    let targetUserId = requester.id;
    let isProxy = false;

    if (onBehalfOfUserId && onBehalfOfUserId !== requester.id) {
      const targetUser = await prisma.user.findUnique({ where: { id: onBehalfOfUserId } });
      if (!targetUser) {
        return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
      }

      const isDesignatedSupervisor = targetUser.supervisorId === requester.id;
      const isDeptLeadership =
        ["DIRECTOR", "SUPERVISOR", "HR", "ADMIN"].includes(requester.role) &&
        targetUser.departmentId === requester.departmentId;

      if (!isDesignatedSupervisor && !isDeptLeadership) {
        return NextResponse.json(
          { error: "You are not authorized to log on behalf of this staff member" },
          { status: 403 }
        );
      }
      targetUserId = targetUser.id;
      isProxy = true;
    }

    const refNo = await generateRefNo("DL"); // NEW

    const log = await prisma.dailyLog.create({
      data: {
        refNo,                                          // NEW
        userId: targetUserId,                            // was: user.id — now supports proxy target
        taskTitle,
        taskCategory,
        taskType: taskType || null,                       // NEW
        description,
        timeSpent: parseFloat(timeSpent),
        priority: priority || "MEDIUM",
        status: status === "DRAFT" ? "DRAFT" : "SUBMITTED",
        caseReference: caseReference || null,
        amountInvolved: amountInvolved ? parseFloat(amountInvolved) : null,
        notes: notes || null,
        loggedByProxy: isProxy,                           // NEW
        proxyLoggedById: isProxy ? requester.id : null,    // NEW
        crossDeptFlag: crossDepartment || null,            // NEW
        ackStatus: (crossDepartment || isProxy) ? "PENDING" : null, // NEW — proxy entries also need owner confirmation now
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: requester.id,
        action: isProxy ? "DAILY_LOG_PROXY_SUBMITTED" : "DAILY_LOG_SUBMITTED", // NEW branch
        detail: isProxy
          ? `Logged on behalf of ${targetUserId}: ${taskTitle}` // NEW
          : `Submitted log: ${taskTitle}`,
      },
    });

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (error) {
    console.error("Daily log error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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

    // NEW — RepeatLog calls GET /api/daily-logs?mine=true&limit=15 to get
    // the user's own recent entries regardless of date, for "repeat this"
    // picking. Everything below this block is your original behavior,
    // untouched, and still runs by default when these params aren't sent.
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine");
    if (mine === "true") {
      const limit = Math.min(50, parseInt(searchParams.get("limit") || "15", 10));
      const logs = await prisma.dailyLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return NextResponse.json({ logs });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logs = await prisma.dailyLog.findMany({
      where: {
        userId: user.id,
        date: { gte: today, lt: tomorrow },
      },
      orderBy: { createdAt: "desc" },
    });

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyCount = await prisma.dailyLog.count({
      where: {
        userId: user.id,
        date: { gte: monthStart },
      },
    });

    return NextResponse.json({ logs, monthlyCount });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
