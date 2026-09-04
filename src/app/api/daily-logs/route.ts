// src/app/api/daily-logs/route.ts
//
// This is YOUR real route with additions layered in — every line of your
// original logic is preserved. Changes are marked with "// NEW".

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateRefNo } from "@/lib/refNo";

// ─── Gemini Retry Helper ────────────────────────────────────────────
async function callGeminiWithRetry(prompt: string, systemPrompt: string, maxRetries = 3) {
  const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );

    const data = await response.json();
    const errMsg: string | undefined = data?.error?.message;

    const isTransient =
      response.status === 429 ||
      response.status === 503 ||
      (errMsg && (errMsg.includes("high demand") || errMsg.includes("quota") || errMsg.includes("overloaded")));

    if (!isTransient) {
      return data;
    }

    if (attempt < maxRetries) {
      const waitMs = attempt * 1500;
      console.log(`Gemini busy, retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const busyError = new Error("GEMINI_BUSY");
    (busyError as any).isTransient = true;
    throw busyError;
  }

  throw new Error("Unreachable");
}

// ─── Groq Fallback ──────────────────────────────────────────────────
async function callGroqFallback(prompt: string, systemPrompt: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq request failed");
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text returned from Groq");
  return text;
}

// ─── Combined Parser ─────────────────────────────────────────────────
async function parseQuickCapture(prompt: string, systemPrompt: string): Promise<string> {
  try {
    const geminiData = await callGeminiWithRetry(prompt, systemPrompt);
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No text returned from Gemini");
    return text;
  } catch (geminiErr: any) {
    if (!process.env.GROQ_API_KEY) {
      throw geminiErr;
    }
    console.warn("Gemini unavailable, falling back to Groq:", geminiErr?.message);
    try {
      return await callGroqFallback(prompt, systemPrompt);
    } catch (groqErr) {
      console.error("Both Gemini and Groq failed:", groqErr);
      throw geminiErr;
    }
  }
}

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
      taskType,
      description,
      timeSpent,
      priority,
      status,
      caseReference,
      amountInvolved,
      notes,
      onBehalfOfUserId,
      crossDepartment,
      taskId,
    } = body;

    if (!taskTitle || !description || !timeSpent || !taskCategory) {
      return NextResponse.json(
        { error: "Task title, category, description and time spent are required" },
        { status: 400 }
      );
    }

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

    const refNo = await generateRefNo("DL");

    const log = await prisma.dailyLog.create({
      data: {
        refNo,
        userId: targetUserId,
        taskTitle,
        taskCategory,
        taskType: taskType || null,
        taskId: taskId || null,
        description,
        timeSpent: parseFloat(timeSpent),
        priority: priority || "MEDIUM",
        status: status === "DRAFT" ? "DRAFT" : "SUBMITTED",
        caseReference: caseReference || null,
        amountInvolved: amountInvolved ? parseFloat(amountInvolved) : null,
        notes: notes || null,
        loggedByProxy: isProxy,
        proxyLoggedById: isProxy ? requester.id : null,
        crossDeptFlag: crossDepartment || null,
        ackStatus: (crossDepartment || isProxy) ? "PENDING" : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: requester.id,
        action: isProxy ? "DAILY_LOG_PROXY_SUBMITTED" : "DAILY_LOG_SUBMITTED",
        detail: isProxy
          ? `Logged on behalf of ${targetUserId}: ${taskTitle}`
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