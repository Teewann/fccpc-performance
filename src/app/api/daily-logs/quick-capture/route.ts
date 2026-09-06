// src/app/api/daily-logs/quick-capture/route.ts
//
// Staff paste one rough block of text describing everything they did.
// This route asks Google Gemini to split it into structured daily-log drafts.
// Nothing is saved here — it only returns drafts for the staff member to
// review and edit before the existing POST /api/daily-logs endpoint saves
// them for real. This keeps the "record of truth" write path unchanged.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // REQUIRED
import { TASK_TYPE_GROUPS } from "@/config/taskTypes";
import prisma from "@/lib/prisma";

// Flatten your existing task type config into a list the model can choose from,
// so quick-capture output always matches valid categories in your system —
// it never invents a taskType that doesn't exist in your dropdown.
function allowedTaskTypes(): string[] {
  return Object.values(TASK_TYPE_GROUPS)
    .flat()
    .map((t: any) => t.value);
}

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const requester = await prisma.user.findUnique({ where: { email: session.user.email } });
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
      { error: "That's a lot of text — try splitting it into two batches." },
      { status: 400 }
    );
  }

  const validTypes = allowedTaskTypes();

  try {
    // ✅ Switch to Google Gemini (Free)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in .env.local");
    }

    // ✅ UPDATED: Using the newest free model gemini-3.6-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SYSTEM_PROMPT(validTypes) + "\n\nSTAFF INPUT:\n" + rawText }] }]
        })
      }
    );

    const data = await response.json();
    const textBlock = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textBlock) {
      // If there is an error from Google, show it clearly
      const geminiError = data?.error?.message || "Unknown API error";
      throw new Error(`No text returned from model. API Error: ${geminiError}`);
    }

    // Model is instructed to return raw JSON, but strip fences defensively
    // in case it wraps the output anyway.
    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    let drafts: any[];
    try {
      drafts = JSON.parse(cleaned);
    } catch {
      // Sometimes Gemini adds extra text around the JSON, try extracting the array
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) drafts = JSON.parse(match[0]);
      else throw new Error("Model did not return valid JSON");
    }

    if (!Array.isArray(drafts)) {
      throw new Error("Expected an array of draft entries");
    }

    // Defensive validation — never trust model output blindly, even though
    // we constrained it heavily in the prompt.
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

    if (safeDrafts.length === 0) {
      return NextResponse.json(
        { error: "Couldn't identify any distinct tasks in that text — try adding a bit more detail." },
        { status: 422 }
      );
    }

    return NextResponse.json({ drafts: safeDrafts });
  } catch (err) {
    console.error("Quick capture parse error:", err);
    return NextResponse.json(
      { error: "AI parsing failed. You can still log manually below." },
      { status: 500 }
    );
  }
}