// src/app/api/tasks/check-overdue/route.ts
//
// The overdue-escalation notification logic used to run inline inside
// every GET /api/tasks request — meaning simply loading the task list
// could trigger database writes, extra per-task queries, and duplicate
// notifications under concurrent requests. Moved here to run on a
// schedule instead (e.g. once every 30-60 minutes via Vercel Cron or an
// OS-level scheduled task), decoupled from anyone just viewing their tasks.
//
// Vercel Cron setup (vercel.json):
//   { "crons": [{ "path": "/api/tasks/check-overdue", "schedule": "0 * * * *" }] }
//
// If self-hosting, hit this from any external scheduler (cron, GitHub
// Actions, etc.) instead — protect it with a shared secret so it can't be
// triggered by random requests.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        treatmentStatus: { not: "ESCALATED" },
      },
      include: { assignedTo: { select: { name: true } } },
      take: 200,
    });

    let notified = 0;
    for (const task of overdueTasks) {
      if (!task.departmentId) continue;
      const director = await prisma.user.findFirst({
        where: { departmentId: task.departmentId, role: "DIRECTOR" },
      });
      if (!director) continue;

      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: director.id,
          title: { contains: task.taskRef || task.id },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (alreadyNotified) continue;

      await prisma.notification.create({
        data: {
          userId: director.id,
          title: `Overdue task: ${task.taskRef || ""}`,
          message: `Task "${task.title}" assigned to ${task.assignedTo?.name || "staff"} is overdue. Due: ${new Date(task.dueDate!).toLocaleDateString("en-GB")}.`,
          type: "ALERT",
          link: "/tasks",
        },
      });
      notified++;
    }

    return NextResponse.json({ checked: overdueTasks.length, notified });
  } catch (error) {
    console.error("Overdue check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}