import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET — fetch questions for a specific exam (no correct answers sent to client)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get("examId");
    if (!examId) return NextResponse.json({ error: "examId required" }, { status: 400 });

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          // Never send the correct answer to the client during the exam
          select: {
            id: true, text: true,
            optionA: true, optionB: true,
            optionC: true, optionD: true,
            marks: true, order: true,
            // correctAnswer is intentionally excluded
          },
        },
      },
    });

    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (!exam.isActive) return NextResponse.json({ error: "This exam is not currently active" }, { status: 403 });

    // Check if already attempted
    const existing = await prisma.examAttempt.findUnique({
      where: { examId_userId: { examId, userId: user.id } },
    });

    if (existing?.completedAt) {
      return NextResponse.json({ error: "You have already completed this exam", attempt: existing }, { status: 400 });
    }

    return NextResponse.json({
      exam: {
        id:          exam.id,
        title:       exam.title,
        description: exam.description,
        duration:    exam.duration,
        passMark:    exam.passMark,
        questions:   exam.questions,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — submit exam answers and calculate score
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { examId, answers } = body;
    // answers = { questionId: "A" | "B" | "C" | "D", ... }

    if (!examId || !answers) {
      return NextResponse.json({ error: "examId and answers are required" }, { status: 400 });
    }

    // Check already submitted
    const existing = await prisma.examAttempt.findUnique({
      where: { examId_userId: { examId, userId: user.id } },
    });
    if (existing?.completedAt) {
      return NextResponse.json({ error: "You have already submitted this exam" }, { status: 400 });
    }

    // Fetch exam with correct answers for scoring
    const exam = await prisma.exam.findUnique({
      where:   { id: examId },
      include: { questions: true },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    // Calculate score
    let totalMarks  = 0;
    let earnedMarks = 0;
    const breakdown: { questionId: string; correct: boolean; selected: string; correctAnswer: string }[] = [];

    for (const question of exam.questions) {
      totalMarks += question.marks;
      const selected = answers[question.id];
      const isCorrect = selected === question.correctAnswer;
      if (isCorrect) earnedMarks += question.marks;
      breakdown.push({
        questionId:    question.id,
        correct:       isCorrect,
        selected:      selected || "—",
        correctAnswer: question.correctAnswer,
      });
    }

    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const passed     = percentage >= exam.passMark;

    const attempt = await prisma.examAttempt.upsert({
      where:  { examId_userId: { examId, userId: user.id } },
      update: {
        answers:     answers,
        score:       earnedMarks,
        percentage,
        passed,
        completedAt: new Date(),
      },
      create: {
        examId,
        userId:      user.id,
        answers:     answers,
        score:       earnedMarks,
        percentage,
        passed,
        completedAt: new Date(),
      },
    });

    // Notify HR/Admin of result
    const admins = await prisma.user.findMany({
      where:  { role: { in: ["ADMIN", "HR"] }, isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId:  admin.id,
          title:   `Exam result: ${user.name}`,
          message: `${user.name} scored ${percentage}% on "${exam.title}" — ${passed ? "PASSED" : "FAILED"}.`,
          type:    passed ? "SUCCESS" : "WARNING",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "EXAM_COMPLETED",
        detail: `"${exam.title}" — ${percentage}% — ${passed ? "PASSED" : "FAILED"}`,
      },
    });

    return NextResponse.json({
      success: true,
      result: {
        score:       earnedMarks,
        totalMarks,
        percentage,
        passed,
        passMark:    exam.passMark,
        breakdown,
        attempt,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}