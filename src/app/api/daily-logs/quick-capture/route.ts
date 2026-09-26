// src/app/api/daily-logs/quick-capture/route.ts
//
// Staff paste one rough block of text describing everything they did.
// This route asks an AI provider to split it into structured daily-log
// drafts. Nothing is saved here — it only returns drafts for the staff
// member to review and edit before the existing POST /api/daily-logs
// endpoint saves them for real. This keeps the "record of truth" write
// path unchanged.
//
// AI providers (in order of preference):
//   1. Google Gemini 3.6 Flash (primary)
//   2. Groq (silent fallback if Gemini fails or is rate-limited)
//
// If GROQ_API_KEY is not set, Groq is skipped entirely and only Gemini
// is used — safe to deploy before you add the key.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TASK_TYPE_GROUPS } from "@/config/taskTypes";
import prisma from "@/lib/prisma";

// ─── Task type whitelist ─────────────────────────────────────────────
function allowedTaskTypes(): string[] {
  return Object.values(TASK_TYPE_GROUPS)
    .flat()
    .map((t: any) => t.value);
}

// ─── Shared prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = (validTypes: string[]) => `
You convert a staff member's rough, informal description of their work day
into structured daily work log entries for a Nigerian federal government
performance-tracking system (FCCPC).

Rules:
- Split the input into one entry per distinct piece of work.
- "taskType" MUST be one of exactly these values: ${validTypes.join(", ")}.
  Pick the closest match. Never invent a new value.
- "timeSpent" is a number of hours (use 0.5 as a minimum, 12 as a max, estimate
  reasonably if not stated — e.g. "quick call" = 0.5, "all morning" = 3).
- "priority" is one of LOW, MEDIUM, HIGH, CRITICAL — infer from tone/urgency,
  default MEDIUM if unclear.
- "taskCategory" is a short human-readable category (e.g. "IT Support",
  "Field Enforcement", "Sensitization", "Case Review").
- "title" is a short, clear restatement (max ~8 words).
- "description" is one clean sentence expanding on the raw text — do not
  invent details that weren't said.
- If the entry mentions doing work FOR or IN another department (e.g. "fixed
  printer for Finance", "went to CBE for outreach"), set
  "crossDepartment" to that department's likely name (best guess string),
  otherwise null.
- Output ONLY a JSON array. No prose, no markdown fences, nothing else.

Output shape per entry:
{
  "title": string,
  "taskCategory": string,
  "taskType": string,
  "description": string,
  "timeSpent": number,
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "crossDepartment": string | null
}
`;

// ─── Timeout wrapper (10 seconds, not 20) ────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit, ms = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Gemini (with retry) ─────────────────────────────────────────────
async function callGemini(
  userText: string,
  systemPrompt: string,
  maxRetries = 3
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[quick-capture] GEMINI_API_KEY missing");
    return null;
  }

  // Default to the model that's been working for you. Override with
  // GEMINI_MODEL env var if you ever want to pin a different version.
  const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userText }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            // NOTE: temperature/top_p/top_k are deprecated in Gemini 3.x
            // and may cause errors — don't send them. Only ask for JSON output.
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        },
        10_000
      );

      const data = await response.json();
      const errMsg: string | undefined = data?.error?.message;

      const isTransient =
        response.status === 429 ||
        response.status === 503 ||
        response.status === 504 ||
        (errMsg &&
          (errMsg.includes("high demand") ||
            errMsg.includes("quota") ||
            errMsg.includes("overloaded") ||
            errMsg.includes("rate limit")));

      if (!isTransient) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        console.warn(`[quick-capture] Gemini returned no text (status ${response.status}):`, errMsg);
        return null;
      }

      console.warn(
        `[quick-capture] Gemini transient error (attempt ${attempt}/${maxRetries}):`,
        errMsg || response.status
      );

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      return null;
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      console.warn(
        `[quick-capture] Gemini call failed (attempt ${attempt}/${maxRetries}):`,
        isAbort ? "timeout" : err?.message
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── Groq (fallback) ─────────────────────────────────────────────────
async function callGroq(userText: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      },
      10_000
    );

    const data = await response.json();

    if (!response.ok) {
      console.warn("[quick-capture] Groq error:", data?.error?.message || response.status);
      return null;
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      console.warn("[quick-capture] Groq returned no text");
      return null;
    }

    return text;
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    console.warn(
      "[quick-capture] Groq call failed:",
      isAbort ? "timeout" : err?.message
    );
    return null;
  }
}

// ─── Parse drafts from a raw model output string ─────────────────────
function parseDraftsFromModelOutput(textBlock: string, validTypes: string[]) {
  const cleaned = textBlock.replace(/```json|```/g, "").trim();

  let drafts: any[];
  try {
    drafts = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Model output contained no JSON array");
    drafts = JSON.parse(match[0]);
  }

  if (!Array.isArray(drafts)) {
    throw new Error("Model output was not an array");
  }

  const safeDrafts = drafts
    .filter((d) => d && typeof d.title === "string")
    .map((d) => ({
      title: String(d.title).slice(0, 200),
      taskCategory: String(d.taskCategory || "General").slice(0, 100),
      taskType: validTypes.includes(d.taskType) ? d.taskType : validTypes[0],
      description: String(d.description || "").slice(0, 1000),
      timeSpent: Math.min(12, Math.max(0.5, Number(d.timeSpent) || 1)),
      priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(d.priority)
        ? d.priority
        : "MEDIUM",
      crossDepartment:
        typeof d.crossDepartment === "string" ? d.crossDepartment : null,
    }));

  return safeDrafts;
}

// ─── POST handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const requester = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!requester) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { rawText } = await req.json();
  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 3) {
    return NextResponse.json(
      { error: "Please describe what you worked on first." },
      { status: 400 }
    );
  }
  if (rawText.length > 4000) {
    return NextResponse.json(
      { error: "That's a lot of text, try splitting it into two batches." },
      { status: 400 }
    );
  }

  const validTypes = allowedTaskTypes();
  const systemPrompt = SYSTEM_PROMPT(validTypes);
  const userText = `STAFF INPUT:\n${rawText}`;

  // ── Provider 1: Gemini 3.6 Flash ─────────────────────────────────
  console.log("[quick-capture] Trying Gemini 3.6 Flash...");
  let textBlock = await callGemini(userText, systemPrompt);
  let providerUsed = "gemini";

  // ── Provider 2: Groq fallback ───────────────────────────────────
  if (!textBlock && process.env.GROQ_API_KEY) {
    console.warn("[quick-capture] Gemini unavailable, falling back to Groq");
    textBlock = await callGroq(userText, systemPrompt);
    providerUsed = "groq";
  }

  if (!textBlock) {
    console.error("[quick-capture] All providers failed");
    return NextResponse.json(
      { error: "AI parsing is temporarily unavailable. You can still log manually below." },
      { status: 503 }
    );
  }

  try {
    const safeDrafts = parseDraftsFromModelOutput(textBlock, validTypes);

    if (safeDrafts.length === 0) {
      return NextResponse.json(
        { error: "Couldn't identify any distinct tasks in that text, try adding a bit more detail." },
        { status: 422 }
      );
    }

    console.log(`[quick-capture] Success via ${providerUsed}, ${safeDrafts.length} drafts`);
    return NextResponse.json({ drafts: safeDrafts });
  } catch (err) {
    console.error("[quick-capture] Parse error from", providerUsed, ":", err);
    return NextResponse.json(
      { error: "AI returned an unexpected format. You can still log manually below." },
      { status: 500 }
    );
  }
}