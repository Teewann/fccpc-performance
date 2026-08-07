import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

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

    const {
      taskTitle,
      taskCategory,
      description,
      timeSpent,
      priority,
      status,
      caseReference,
      amountInvolved,
      notes,
    } = body;

    if (!taskTitle || !description || !timeSpent || !taskCategory) {
      return NextResponse.json(
        { error: "Task title, category, description and time spent are required" },
        { status: 400 }
      );
    }

    const log = await prisma.dailyLog.create({
      data: {
        userId: user.id,
        taskTitle,
        taskCategory,
        description,
        timeSpent: parseFloat(timeSpent),
        priority: priority || "MEDIUM",
        status: status === "DRAFT" ? "DRAFT" : "SUBMITTED",
        caseReference: caseReference || null,
        amountInvolved: amountInvolved ? parseFloat(amountInvolved) : null,
        notes: notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "DAILY_LOG_SUBMITTED",
        detail: `Submitted log: ${taskTitle}`,
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
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
