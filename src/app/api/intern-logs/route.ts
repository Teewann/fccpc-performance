import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPrivileged = ["SUPERVISOR","DIRECTOR","HR","ADMIN","EXECUTIVE"].includes(user.role);

    const logs = await prisma.internLog.findMany({
      where: isPrivileged
        ? (user.departmentId ? { user: { departmentId: user.departmentId } } : {})
        : { userId: user.id },
      include: { user: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { taskTitle, description, skillsLearned, supervisorName, hoursSpent, weekNumber } = body;

    if (!taskTitle || !description || !hoursSpent) {
      return NextResponse.json({ error: "Task title, description and hours are required" }, { status: 400 });
    }

    const log = await prisma.internLog.create({
      data: {
        userId:         user.id,
        taskTitle,
        description,
        skillsLearned:  skillsLearned  || null,
        supervisorName: supervisorName || null,
        hoursSpent:     parseFloat(hoursSpent),
        weekNumber:     weekNumber ? parseInt(weekNumber) : null,
        status:         "SUBMITTED",
      },
    });

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPrivileged = ["SUPERVISOR","DIRECTOR","HR","ADMIN","EXECUTIVE"].includes(user.role);
    if (!isPrivileged) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const body = await request.json();
    const { logId, status, supervisorComment } = body;
    if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

    const log = await prisma.internLog.update({
      where: { id: logId },
      data: {
        ...(status            ? { status }            : {}),
        ...(supervisorComment ? { supervisorComment } : {}),
      },
    });

    // Notify the intern
    if (status) {
      await prisma.notification.create({
        data: {
          userId:  log.userId,
          title:   `Intern log ${status.toLowerCase()}`,
          message: `Your log "${log.taskTitle}" was ${status.toLowerCase()}.${supervisorComment ? ` Comment: ${supervisorComment}` : ""}`,
          type:    status === "APPROVED" ? "SUCCESS" : "WARNING",
        },
      });
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
