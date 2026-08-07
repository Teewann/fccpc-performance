import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── GET — fetch exams (Admin/HR sees all, Staff sees available ones) ─
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPrivileged = ["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(user.role);

    const exams = await prisma.exam.findMany({
      where: isPrivileged ? {} : { isActive: true },
      include: {
        _count: { select: { questions: true, attempts: true } },
        attempts: {
          where:  { userId: user.id },
          select: { id: true, score: true, percentage: true, passed: true, completedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ exams });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST — create a new exam (Admin/HR only) ─────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!["ADMIN", "HR", "EXECUTIVE"].includes(user.role)) {
      return NextResponse.json({ error: "Only Admin and HR can create exams" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, targetRole, gradeLevel, duration, passMark, questions } = body;

    if (!title || !targetRole || !duration) {
      return NextResponse.json({ error: "Title, target role and duration are required" }, { status: 400 });
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
    }

    // Validate all questions
    for (const q of questions) {
      if (!q.text || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
        return NextResponse.json({ error: "All question fields are required" }, { status: 400 });
      }
      if (!["A", "B", "C", "D"].includes(q.correctAnswer)) {
        return NextResponse.json({ error: "Correct answer must be A, B, C or D" }, { status: 400 });
      }
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        description:  description || null,
        targetRole,
        gradeLevel:   gradeLevel  || null,
        duration:     parseInt(duration),
        passMark:     passMark ? parseInt(passMark) : 60,
        isActive:     true,
        questions: {
          create: questions.map((q: any, i: number) => ({
            text:          q.text,
            optionA:       q.optionA,
            optionB:       q.optionB,
            optionC:       q.optionC,
            optionD:       q.optionD,
            correctAnswer: q.correctAnswer,
            marks:         q.marks ? parseInt(q.marks) : 1,
            order:         i,
          })),
        },
      },
      include: {
        questions: true,
        _count: { select: { questions: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EXAM_CREATED",
        detail: `Exam created: "${title}" for ${targetRole}`,
      },
    });

    return NextResponse.json({ success: true, exam }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH — toggle exam active/inactive ─────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user || !["ADMIN", "HR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { examId, isActive } = body;
    if (!examId) return NextResponse.json({ error: "examId required" }, { status: 400 });

    const exam = await prisma.exam.update({
      where: { id: examId },
      data:  { isActive },
    });

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


