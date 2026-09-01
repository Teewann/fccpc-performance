// src/app/api/daily-logs/[id]/acknowledge/route.ts
//
// Handles both confirmation triggers that share the ackStatus field:
//   1. Proxy entries — only the staff member the log was logged FOR can act.
//   2. Cross-department claims — anyone in the flagged department, or
//      HR/Admin as a governance fallback, can act.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ CHANGED TO PROMISE
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ FIXED: AWAIT the params object
    const { id } = await params;

    const log = await prisma.dailyLog.findUnique({ where: { id } }); // ✅ Now uses 'id' correctly
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }
    if (log.ackStatus !== "PENDING") {
      return NextResponse.json({ error: "This entry isn't awaiting confirmation" }, { status: 400 });
    }

    const body = await request.json();
    const { action, note } = body; // action: "CONFIRM" | "DISPUTE"
    if (!["CONFIRM", "DISPUTE"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Authorization: figure out WHY this needs confirmation, and check the
    // requester is actually allowed to act on it.
    let authorized = false;

    if (log.loggedByProxy) {
      // Only the person the log was logged FOR can confirm/dispute it.
      authorized = log.userId === requester.id;
    }

    if (!authorized && log.crossDeptFlag) {
      const flagged = log.crossDeptFlag.toLowerCase();
      const ownDept = requester.department?.name?.toLowerCase() || "";
      const isDeptMatch = ownDept && (flagged.includes(ownDept) || ownDept.includes(flagged));
      const isGovernanceOverride = ["HR", "ADMIN"].includes(requester.role);
      authorized = isDeptMatch || isGovernanceOverride;
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "You are not authorized to confirm or dispute this entry" },
        { status: 403 }
      );
    }

    const updated = await prisma.dailyLog.update({
      where: { id },
      data: {
        ackStatus: action === "CONFIRM" ? "CONFIRMED" : "DISPUTED",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: requester.id,
        action: action === "CONFIRM" ? "LOG_ACK_CONFIRMED" : "LOG_ACK_DISPUTED",
        detail: `${action === "CONFIRM" ? "Confirmed" : "Disputed"} log "${log.taskTitle}" (${log.refNo || log.id})${note ? ` — note: ${note}` : ""}`,
      },
    });

    // Notify the original logger either way — they should know the outcome.
    const notifyUserId = log.loggedByProxy ? log.proxyLoggedById : log.userId;
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          title: action === "CONFIRM" ? "Log entry confirmed" : "Log entry disputed",
          message: `"${log.taskTitle}" was ${action === "CONFIRM" ? "confirmed" : "disputed"} by ${requester.name}.${note ? ` Note: ${note}` : ""}`,
          type: action === "CONFIRM" ? "SUCCESS" : "WARNING",
        },
      });
    }

    return NextResponse.json({ success: true, log: updated });
  } catch (error) {
    console.error("Acknowledge error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}