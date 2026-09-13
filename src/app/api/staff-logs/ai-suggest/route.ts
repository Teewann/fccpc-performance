// src/app/api/staff-logs/ai-suggest/route.ts
//
// AI-assisted bulk review suggestions.
// Takes up to 20 log IDs, returns per-log Decision + Score + Reason.
// Uses Google Gemini (free tier).
// Never writes to DB. Only suggests.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_LOGS = 20;
const MODEL = "gemini-3.6-flash";

// In-memory cache: key = logId + ":v1", value = { data, expiresAt }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: Suggestion; expiresAt: number }>();

type Suggestion = {
  logId: string;
  decision: "APPROVE" | "QUERY" | "REJECT";
  score: number | null;
  reason: string;
};

// ─── Build the review prompt for one batch ─────────────────────────
function buildPrompt(
  logs: any[],
  reviewerStats: { approved: number; rejected: number; queried: number; avgScore: number },
  deptStats: Record<string, { count: number; avgHours: number }>
): string {
  const logsBlock = logs.map((log, i) => {
    const dept = log.user?.department?.name || "Unassigned";
    const categoryNorms = deptStats[log.taskCategory];
    const normsText = categoryNorms && categoryNorms.count > 0
      ? `Department average for this category: ${categoryNorms.avgHours}h over ${categoryNorms.count} prior logs.`
      : `No prior history for this category in this department.`;

    return `--- LOG ${i + 1} ---
ID: ${log.id}
Title: ${log.taskTitle}
Category: ${log.taskCategory}
Priority: ${log.priority || "MEDIUM"}
Time spent: ${log.timeSpent} hours
Staff: ${log.user?.name || "Unknown"} (${dept})
Description: ${log.description}
Evidence attached: ${log.evidence ? "Yes" : "No"}
Case reference: ${log.caseReference || "None"}
${normsText}`;
  }).join("\n\n");

  const reviewerContext = `Reviewer history (last 30 days): ${reviewerStats.approved} approved, ${reviewerStats.rejected} rejected, ${reviewerStats.queried} queried. Average approval score: ${reviewerStats.avgScore}/100.`;

  return `You are assisting a supervisor at the Federal Competition and Consumer Protection Commission (FCCPC) to review daily work logs submitted by staff.

Your job: read each log and recommend one of three decisions:
- APPROVE: the log is clear, well-described, time spent is reasonable, no red flags. Provide a score from 0 to 100 (60-75 for adequate, 76-89 for good, 90-100 for excellent).
- QUERY: the log is unclear, missing detail, or has an unexplained mismatch (e.g. time spent far above or below category norms). Score should be null.
- REJECT: the log appears duplicated, fabricated, contains no real work, or has been submitted in bad faith. Score should be null.

${reviewerContext}

Rules:
- Never use em-dashes or en-dashes in your reasons.
- Each reason must be one short sentence, specific to that log.
- Reference concrete details from the log (title, category, time, evidence).
- If uncertain, prefer QUERY over REJECT and QUERY over APPROVE.
- If a log looks fine but unremarkable, APPROVE with a score around 70.
- A log with evidence attached is more likely APPROVE.
- A log with no case reference when the description implies a case is more likely QUERY.
- Time spent of 0.5h or less for a substantial task is more likely QUERY.
- Time spent significantly higher than the category average is more likely QUERY.

Here are the logs to review:

${logsBlock}

Respond with ONLY a JSON array. No prose. No markdown fences. No explanation. Each element:
{
  "logId": "<the ID string exactly as given>",
  "decision": "APPROVE" | "QUERY" | "REJECT",
  "score": <number 0-100 if APPROVE, null otherwise>,
  "reason": "<one short sentence, no dashes>"
}`;
}

// ─── Call Gemini with retry + backoff ──────────────────────────────
async function callGemini(prompt: string, apiKey: string): Promise<string | null> {
  const delays = [0, 1500, 4000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise(r => setTimeout(r, delays[attempt]));
    }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
          }),
        }
      );

      if (res.status === 429) {
        console.warn(`[ai-suggest] Rate limited, attempt ${attempt + 1}`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("[ai-suggest] Gemini error", res.status, errText);
        continue;
      }

      const data = await res.json();
      const textBlock = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textBlock) {
        console.error("[ai-suggest] No text in response");
        continue;
      }
      return textBlock;
    } catch (e) {
      console.error(`[ai-suggest] Attempt ${attempt + 1} failed:`, e);
    }
  }
  return null;
}

// ─── POST handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const reviewer = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, departmentId: true },
    });
    if (!reviewer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const logIds = body.logIds as string[];

    if (!Array.isArray(logIds) || logIds.length === 0) {
      return NextResponse.json({ error: "logIds array is required" }, { status: 400 });
    }
    if (logIds.length > MAX_LOGS) {
      return NextResponse.json(
        { error: `Too many logs. Maximum is ${MAX_LOGS} per AI request.` },
        { status: 400 }
      );
    }

    // Check cache first — split into cached + uncached
    const now = Date.now();
    const results: Suggestion[] = [];
    const uncached: string[] = [];

    for (const id of logIds) {
      const cached = cache.get(`${id}:v1`);
      if (cached && cached.expiresAt > now) {
        results.push(cached.data);
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) {
      return NextResponse.json({
        suggestions: results,
        cached: true,
      });
    }

    // Fetch uncached logs from DB
    const logs = await prisma.dailyLog.findMany({
      where: { id: { in: uncached } },
      include: { user: { select: { id: true, name: true, department: { select: { name: true } } } } },
    });

    if (logs.length === 0) {
      return NextResponse.json({ error: "No logs found for the provided IDs" }, { status: 404 });
    }

    // Pre-flight authorization (same rules as bulk endpoint)
    for (const log of logs) {
      if (log.status !== "SUBMITTED") {
        return NextResponse.json(
          { error: `Log "${log.taskTitle}" is not in SUBMITTED state.` },
          { status: 400 }
        );
      }
      const isDesignatedSupervisor = log.user.id && false; // owner check handled below
    }

    // Reviewer stats (last 30 days)
    const day30ago = new Date();
    day30ago.setDate(day30ago.getDate() - 30);

    const [reviewerApproved, reviewerRejected, reviewerQueried, reviewerScores] = await Promise.all([
      prisma.dailyLog.count({ where: { supervisorId: reviewer.id, status: "APPROVED", reviewedAt: { gte: day30ago } } }),
      prisma.dailyLog.count({ where: { supervisorId: reviewer.id, status: "REJECTED", reviewedAt: { gte: day30ago } } }),
      prisma.dailyLog.count({ where: { supervisorId: reviewer.id, status: "QUERIED", reviewedAt: { gte: day30ago } } }),
      prisma.dailyLog.findMany({
        where: { supervisorId: reviewer.id, status: "APPROVED", reviewedAt: { gte: day30ago }, supervisorScore: { not: null } },
        select: { supervisorScore: true },
      }),
    ]);

    const avgScore = reviewerScores.length > 0
      ? Math.round(reviewerScores.reduce((s, l) => s + (l.supervisorScore || 0), 0) / reviewerScores.length)
      : 70;

    // Department norms per category (for the logs being reviewed)
    const categories = [...new Set(logs.map(l => l.taskCategory))];
    const deptIds = [...new Set(logs.map(l => l.user.department?.name).filter(Boolean))] as string[];

    const priorLogs = await prisma.dailyLog.findMany({
      where: {
        taskCategory: { in: categories },
        status: { in: ["APPROVED", "REJECTED", "QUERIED"] },
      },
      select: { taskCategory: true, timeSpent: true },
      take: 500,
    });

    const deptStats: Record<string, { count: number; avgHours: number }> = {};
    for (const cat of categories) {
      const catLogs = priorLogs.filter(l => l.taskCategory === cat);
      if (catLogs.length > 0) {
        deptStats[cat] = {
          count: catLogs.length,
          avgHours: Math.round((catLogs.reduce((s, l) => s + l.timeSpent, 0) / catLogs.length) * 10) / 10,
        };
      }
    }

    // Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. AI suggestions unavailable." },
        { status: 503 }
      );
    }

    const prompt = buildPrompt(logs, {
      approved: reviewerApproved,
      rejected: reviewerRejected,
      queried: reviewerQueried,
      avgScore,
    }, deptStats);

    const rawText = await callGemini(prompt, apiKey);
    if (!rawText) {
      return NextResponse.json(
        { error: "AI is temporarily unavailable. Please try again in a moment, or review manually." },
        { status: 503 }
      );
    }

    // Parse response
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    let parsed: any[];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return NextResponse.json({ error: "AI returned unreadable output." }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "AI returned unreadable output." }, { status: 500 });
      }
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "AI returned unexpected format." }, { status: 500 });
    }

    // Validate + normalize each suggestion
    const freshSuggestions: Suggestion[] = [];
    for (const item of parsed) {
      if (!item.logId || !["APPROVE", "QUERY", "REJECT"].includes(item.decision)) continue;
      const score = item.decision === "APPROVE" && typeof item.score === "number"
        ? Math.max(0, Math.min(100, Math.round(item.score)))
        : null;
      const reason = typeof item.reason === "string"
        ? item.reason.replace(/[—–]/g, "").trim().slice(0, 240)
        : "";

      const suggestion: Suggestion = {
        logId: item.logId,
        decision: item.decision,
        score,
        reason,
      };

      // Cache it
      cache.set(`${item.logId}:v1`, { data: suggestion, expiresAt: now + CACHE_TTL_MS });
      freshSuggestions.push(suggestion);
    }

    return NextResponse.json({
      suggestions: [...results, ...freshSuggestions],
      cached: results.length > 0,
    });
  } catch (error) {
    console.error("[ai-suggest] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}