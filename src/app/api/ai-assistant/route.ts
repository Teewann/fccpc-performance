import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── Build a detailed user/system context string ────────────────────
async function buildContext(user: any): Promise<string> {
  const now = new Date();
  const day30ago = new Date(now); day30ago.setDate(now.getDate() - 30);
  const day7ago  = new Date(now); day7ago.setDate(now.getDate() - 7);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const canSeeTeam = ["SUPERVISOR", "DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(user.role);

  const [
    logs30, approved30, pending, weekLogs, todayLogs,
    tasks, unreadNotif, leaves, topPerformers,
  ] = await Promise.all([
    prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago } } }),
    prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago }, status: "APPROVED" } }),
    prisma.dailyLog.count({ where: { userId: user.id, status: "SUBMITTED" } }),
    prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day7ago } } }),
    prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: todayStart } } }),
    prisma.task.findMany({
      where: { assignedToId: user.id, status: { not: "COMPLETED" } },
      select: { title: true, status: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.leaveRequest.findMany({
      where: { userId: user.id },
      select: { type: true, days: true, status: true, startDate: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Only pull team-wide data for roles allowed to see it
    canSeeTeam
      ? prisma.dailyLog.groupBy({
          by: ["userId"],
          where: { createdAt: { gte: day30ago }, status: "APPROVED" },
          _count: { _all: true },
          orderBy: { _count: { userId: "desc" } },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const approvalRate = logs30 > 0 ? Math.round((approved30 / logs30) * 100) : 0;
  const taskList = tasks.map(t => `${t.title} (${t.status}${t.dueDate ? `, due ${new Date(t.dueDate).toLocaleDateString("en-GB")}` : ""})`).join("; ") || "none";
  const leaveList = leaves.map(l => `${l.type}: ${l.days}d, ${l.status}`).join("; ") || "none";

  let teamSection = "";
  if (canSeeTeam && topPerformers.length > 0) {
    const ids = topPerformers.map((t: any) => t.userId);
    const names = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, department: { select: { name: true } } },
    });
    const nameMap = new Map(names.map(n => [n.id, n]));
    const lines = topPerformers.map((t: any) => {
      const info = nameMap.get(t.userId);
      return `${info?.name || "Unknown"} (${info?.department?.name || "N/A"}) — ${t._count._all} approved logs`;
    });
    teamSection = `\nTop performers (last 30 days, by approved logs): ${lines.join("; ")}.`;
  }

  return `User: ${user.name}, Role: ${user.role}, Dept: ${user.department?.name || "N/A"}.
Logs last 30 days: ${logs30} submitted, ${approved30} approved (${approvalRate}%).
This week: ${weekLogs}, Today: ${todayLogs}, Pending review: ${pending}.
Open tasks: ${taskList}. Unread notifications: ${unreadNotif}.
Leave requests: ${leaveList}.${teamSection}`;
}

// ─── System instruction: full picture of what the app can do ───────
const SYSTEM_INSTRUCTION = `You are the FCCPC Performance Intelligence Assistant, an in-app helper for staff of the Federal Competition and Consumer Protection Commission.

Your job: answer questions clearly, accurately, and completely using the user context provided. Be direct and helpful — don't pad answers with unnecessary caveats, but do explain your reasoning briefly when giving performance feedback or recommendations. If the user asks something broader than their personal data (e.g. "how does the leave policy work", "what does this page do", "how can I improve"), answer it fully using your general knowledge of the system below, even if it's not directly in their personal data.

Pages and features in this system, so you can guide users to the right place:
- /dashboard — personal/executive overview
- /staff-logs — view submitted log history
- /daily-log — submit daily work logs
- /check-in — attendance / clock in-out
- /id-card — view/download staff ID card
- /intern — intern-specific work logs
- /supervisor — review panel for supervisors/managers
- /departments — department directory and scores
- /tasks — assigned tasks and task management
- /kpi — KPI tracking (management roles)
- /appraisals — performance appraisals
- /leave — leave requests and balances
- /evc-directives — Executive Vice Chairman directives
- /compliance — business compliance tracking
- /portal — business registration portal
- /payment-workflow — payment request tracking
- /case-transfer — inter-office case transfers
- /ai-insights — AI-generated performance insights (management)
- /reports — generated reports
- /announcements — announcements and internal memos
- /exams — promotion exams
- /staff-directory — staff directory
- /chat — internal messaging
- /users — user management (admin only)
- /audit-trail — system audit logs (admin only)
- /settings — account settings

FCCPC leave entitlements: Annual 30 working days, Sick 15 days (medical certificate required), Maternity 16 weeks fully paid, Paternity 5 working days, Casual up to 7 days/year.

When giving performance feedback, be specific: cite the actual numbers from the user's context, explain what's good or needs improvement, and suggest one concrete next step. When asked about team/top performers, only answer if that data is included in the context — if it's not there, explain that this view isn't available for their role rather than guessing.

Keep answers focused and well-organized (use short paragraphs or bullet points for lists), but don't artificially truncate — give the user the full, useful answer.`;

// ─── Local fallback (rule‑based, used only if Gemini is unavailable) ─
async function localReply(user: any, question: string): Promise<string> {
  const now = new Date();
  const day30ago = new Date(now); day30ago.setDate(now.getDate() - 30);
  const day7ago  = new Date(now); day7ago.setDate(now.getDate() - 7);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const q = question.toLowerCase();

  if (/^(hi|hello|hey|good (morning|afternoon|evening))/.test(q))
    return `Hello ${user.name}! I'm your FCCPC assistant. Ask me about your logs, tasks, leave, or performance.`;
  if (/how are you|what('s| is) up/.test(q))
    return "I'm always ready to help with your FCCPC work. What would you like to know?";
  if (/thank(s| you)/.test(q))
    return "You're welcome! Anything else I can assist with?";

  if (q.includes("log") && (q.includes("week") || q.includes("this week"))) {
    const weekLogs = await prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day7ago } } });
    return `You have submitted ${weekLogs} log(s) this week.`;
  }
  if (q.includes("log") && (q.includes("today") || q.includes("submitted today") || q.includes("logged today"))) {
    const todayLogs = await prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: todayStart } } });
    return `You submitted ${todayLogs} log(s) today.`;
  }
  if (q.includes("log") && (q.includes("month") || q.includes("30 days") || q.includes("last month"))) {
    const logs30 = await prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago } } });
    return `You have submitted ${logs30} log(s) in the last 30 days.`;
  }

  if (/approval|rate|how am i doing|my performance|score|perf/.test(q)) {
    const [total30, approved30] = await Promise.all([
      prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago } } }),
      prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago }, status: "APPROVED" } }),
    ]);
    const rate = total30 > 0 ? Math.round((approved30 / total30) * 100) : 0;
    const comment = rate >= 80 ? "Excellent!" : rate >= 60 ? "You're doing well." : "There's room for improvement.";
    return `Your approval rate over the last 30 days is ${rate}% (${approved30} approved out of ${total30} submitted). ${comment}`;
  }

  if (/pending|waiting|review/.test(q)) {
    const pending = await prisma.dailyLog.count({ where: { userId: user.id, status: "SUBMITTED" } });
    return pending > 0
      ? `You have ${pending} log(s) waiting for supervisor review.`
      : "You have no pending logs – all have been reviewed. Great job!";
  }

  if (/recent|latest|my logs|history/.test(q)) {
    const recent = await prisma.dailyLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { taskTitle: true, status: true, createdAt: true },
    });
    if (recent.length === 0) return "You haven't submitted any logs yet.";
    const lines = recent.map(l => `• ${l.taskTitle} – ${l.status} (${new Date(l.createdAt).toLocaleDateString("en-GB")})`);
    return `Your most recent logs:\n${lines.join("\n")}`;
  }

  if (/leave|vacation|holiday/.test(q)) {
    const [allLeave, approvedLeave, pendingLeave] = await Promise.all([
      prisma.leaveRequest.count({ where: { userId: user.id } }),
      prisma.leaveRequest.findMany({
        where: { userId: user.id, status: "APPROVED" },
        select: { type: true, days: true, startDate: true },
        orderBy: { startDate: "desc" },
        take: 3,
      }),
      prisma.leaveRequest.count({ where: { userId: user.id, status: "PENDING" } }),
    ]);
    let reply = `You have ${allLeave} leave request(s) on file (${pendingLeave} pending). `;
    if (approvedLeave.length > 0) {
      const approvedList = approvedLeave.map(l => `${l.type} (${l.days} days, from ${new Date(l.startDate).toLocaleDateString("en-GB")})`).join(", ");
      reply += `Recently approved: ${approvedList}.`;
    } else {
      reply += "No approved leave yet.";
    }
    return reply;
  }

  if (/task|assigned/.test(q)) {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: user.id, status: { not: "COMPLETED" } },
      select: { title: true, status: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    });
    if (tasks.length === 0) return "You have no open tasks. Great job!";
    const lines = tasks.map(t => `• ${t.title} – ${t.status}${t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString("en-GB")})` : ""}`);
    return `Here are your upcoming tasks:\n${lines.join("\n")}`;
  }

  if (/notification|unread/.test(q)) {
    const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
    return `You have ${unread} unread notification(s).`;
  }

  if (/page|navigate|where|how do I/.test(q)) {
    return `Here are some useful pages:\n• /dashboard – Executive overview\n• /daily-log – Submit work\n• /check-in – Attendance\n• /leave – Leave requests\n• /tasks – Assigned tasks\n• /staff-logs – Your log history\n• /supervisor – Review panel (supervisors)\n• /settings – Account settings`;
  }

  if (/leave policy|how many days leave/.test(q)) {
    return "FCCPC leave entitlements:\n- Annual: 30 working days\n- Sick: 15 days (medical certificate required)\n- Maternity: 16 weeks fully paid\n- Paternity: 5 working days\n- Casual: up to 7 days per year";
  }

  if (/password|change password/.test(q)) {
    return "You can change your password in Settings > My Account. If you forgot your password, use the Forgot Password link on the login page.";
  }

  if (/what can you do|help|capabilities|anything|any other thing/.test(q)) {
    return `I can help you with many things, for example:\n• "How am I performing this month?"\n• "Show my recent logs"\n• "How much leave have I taken?"\n• "What tasks are assigned to me?"\n• "Where can I submit my work?"\nJust type your question naturally.`;
  }

  const [totalLogs30, approved30] = await Promise.all([
    prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago } } }),
    prisma.dailyLog.count({ where: { userId: user.id, createdAt: { gte: day30ago }, status: "APPROVED" } }),
  ]);
  const approvalRate = totalLogs30 > 0 ? Math.round((approved30 / totalLogs30) * 100) : 0;

  const fallbacks = [
    `Your profile: ${user.name} (${user.role}). Last 30 days: ${totalLogs30} logs, ${approvalRate}% approval rate. Ask me about your logs, tasks, or leave.`,
    `Hi ${user.name}! You have submitted ${totalLogs30} logs this month with ${approvalRate}% approved. Need help with something specific?`,
    `Here's a quick summary: ${totalLogs30} logs submitted, ${approved30} approved (${approvalRate}%). You can also ask about pending reviews, assigned tasks, or leave balance.`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ─── Gemini API call — now with full conversation history ──────────
async function geminiReply(
  context: string,
  history: { role: string; content: string }[],
  apiKey: string
): Promise<string | null> {
  try {
    // Gemini expects role "model" instead of "assistant"
    const contents = history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Inject the live user context as the first turn so Gemini always has fresh data
    contents.unshift({
      role: "user",
      parts: [{ text: `Here is my current data context:\n${context}\n\nKeep this in mind when answering my questions below.` }],
    });
    contents.splice(1, 0, {
      role: "model",
      parts: [{ text: "Understood, I have your current data. Go ahead and ask." }],
    });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Gemini API error]", res.status, errText);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[Gemini API] No text in response:", JSON.stringify(data));
      return null;
    }
    return text;
  } catch (err) {
    console.error("[Gemini API] Request failed:", err);
    return null;
  }
}

// ─── POST handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, role: true, staffId: true, department: { select: { name: true } } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { messages } = body as { messages: { role: string; content: string }[] };
    if (!messages?.length) return NextResponse.json({ error: "No question provided" }, { status: 400 });

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) return NextResponse.json({ reply: "I didn't catch that." });

    const context = await buildContext(user);

    let reply: string | null = null;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      // Send the FULL conversation history, not just the last message
      reply = await geminiReply(context, messages, geminiKey);
    } else {
      console.warn("[AI Assistant] GEMINI_API_KEY not set — using local fallback engine.");
    }

    if (!reply) {
      reply = await localReply(user, lastUserMsg.content);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[AI Assistant]", error);
    return NextResponse.json({ reply: "Something went wrong." }, { status: 500 });
  }
}