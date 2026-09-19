// src/app/api/daily-logs/[id]/review/route.ts
//
// The missing piece: an actual action for a supervisor to approve, reject,
// or query a submitted log, with a score and comment. Everything before
// this only displayed a score if one already existed — nothing set it.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LogStatus } from "@prisma/client";
const REVIEW_CAPABLE_ROLES = ["DIRECTOR", "SUPERVISOR", "HR", "ADMIN", "EXECUTIVE"];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const reviewer = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!reviewer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const log = await prisma.dailyLog.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, departmentId: true, supervisorId: true } } },
    });
    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    // Authorization: the designated supervisor, or department leadership,
    // or org-wide HR/Admin/Executive.
    const isDesignatedSupervisor = log.user.supervisorId === reviewer.id;
    const isDeptLeadership =
      ["DIRECTOR", "SUPERVISOR"].includes(reviewer.role) &&
      log.user.departmentId === reviewer.departmentId;
    const isOrgWide = ["HR", "ADMIN", "EXECUTIVE"].includes(reviewer.role);

    if (!isDesignatedSupervisor && !isDeptLeadership && !isOrgWide) {
      return NextResponse.json({ error: "You're not authorized to review this log" }, { status: 403 });
    }

    if (log.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Only submitted logs can be reviewed" }, { status: 400 });
    }

    const body = await request.json();
    const { decision, score, comment } = body; // decision: "APPROVE" | "REJECT" | "QUERY"

    if (!["APPROVE", "REJECT", "QUERY"].includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }
    if (decision === "APPROVE" && (score == null || score < 1 || score > 10)) {
      return NextResponse.json({ error: "A score from 1 to 10 is required to approve" }, { status: 400 });
    }

const statusMap: Record<string, LogStatus> = {
  APPROVE: "APPROVED" as LogStatus,
  REJECT: "REJECTED" as LogStatus,
  QUERY: "QUERIED" as LogStatus,
};
    const updated = await prisma.dailyLog.update({
      where: { id: params.id },
      data: {
        status: statusMap[decision],
        supervisorId: reviewer.id,
        supervisorScore: decision === "APPROVE" ? score : null,
        supervisorComment: comment || null,
        reviewedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: log.userId,
        title:
          decision === "APPROVE" ? "Log approved" :
          decision === "REJECT" ? "Log rejected" : "Log queried",
        message:
          `"${log.taskTitle}" was ${decision === "APPROVE" ? "approved" : decision === "REJECT" ? "rejected" : "queried"} by ${reviewer.name}` +
          (comment ? `. Note: ${comment}` : "."),
        type: decision === "APPROVE" ? "SUCCESS" : decision === "REJECT" ? "WARNING" : "INFO",
        link: "/daily-log",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: reviewer.id,
        action: `LOG_${statusMap[decision]}`,
        detail: `${statusMap[decision]} log "${log.taskTitle}" (${log.refNo || log.id})${comment ? ` — ${comment}` : ""}`,
      },
    });

    return NextResponse.json({ success: true, log: updated });
  } catch (error) {
    console.error("Log review error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}