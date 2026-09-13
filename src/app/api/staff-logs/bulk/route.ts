// src/app/api/staff-logs/bulk/route.ts
//
// Bulk review with per-log decisions.
// Each entry in `decisions` array has its own action, score, and comment.
// Pre-flight authorization on all logs. If any fails, the whole batch is rejected.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type Decision = {
  logId: string;
  status: "APPROVED" | "REJECTED" | "QUERIED";
  score?: number | null;
  comment?: string;
};

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const reviewer = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!reviewer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const decisions = body.decisions as Decision[];

    if (!Array.isArray(decisions) || decisions.length === 0) {
      return NextResponse.json({ error: "decisions array is required" }, { status: 400 });
    }

    // Validate each decision
    for (const d of decisions) {
      if (!d.logId) {
        return NextResponse.json({ error: "Every decision requires logId" }, { status: 400 });
      }
      if (!["APPROVED", "REJECTED", "QUERIED"].includes(d.status)) {
        return NextResponse.json({ error: `Invalid status for log ${d.logId}` }, { status: 400 });
      }
      if (d.status === "APPROVED") {
        const s = d.score != null ? parseInt(String(d.score), 10) : null;
        if (s == null || s < 0 || s > 100) {
          return NextResponse.json({ error: `Approved log ${d.logId} requires a score from 0 to 100` }, { status: 400 });
        }
      }
    }

    const logIds = decisions.map(d => d.logId);

    // Load all target logs with owners
    const logs = await prisma.dailyLog.findMany({
      where: { id: { in: logIds } },
      include: { user: { select: { id: true, name: true, departmentId: true, supervisorId: true } } },
    });

    if (logs.length === 0) {
      return NextResponse.json({ error: "No logs found for the provided IDs" }, { status: 404 });
    }

    const logMap = new Map(logs.map(l => [l.id, l]));

    // Pre-flight authorization on every decision
    const unauthorized: { id: string; title: string; reason: string }[] = [];
    for (const d of decisions) {
      const log = logMap.get(d.logId);
      if (!log) {
        unauthorized.push({ id: d.logId, title: "(not found)", reason: "log not found" });
        continue;
      }
      if (log.status !== "SUBMITTED") {
        unauthorized.push({ id: log.id, title: log.taskTitle, reason: `status is ${log.status}` });
        continue;
      }
      const isDesignatedSupervisor = log.user.supervisorId === reviewer.id;
      const isDeptLeadership =
        ["DIRECTOR", "SUPERVISOR"].includes(reviewer.role) &&
        log.user.departmentId === reviewer.departmentId;
      const isOrgWide = ["HR", "ADMIN", "EXECUTIVE"].includes(reviewer.role);
      if (!isDesignatedSupervisor && !isDeptLeadership && !isOrgWide) {
        unauthorized.push({ id: log.id, title: log.taskTitle, reason: "not authorized" });
      }
    }

    if (unauthorized.length > 0) {
      return NextResponse.json({
        error: `Cannot process ${unauthorized.length} log(s) - pre-flight check failed`,
        unauthorized,
      }, { status: 400 });
    }

    // Apply each decision sequentially
    let ok = 0;
    const errors: { id: string; error: string }[] = [];

    for (const d of decisions) {
      const log = logMap.get(d.logId)!;
      try {
        const numericScore = d.status === "APPROVED"
          ? parseInt(String(d.score), 10)
          : null;

        await prisma.dailyLog.update({
          where: { id: log.id },
          data: {
            status: d.status,
            supervisorId: reviewer.id,
            supervisorScore: numericScore,
            supervisorComment: d.comment || null,
            reviewedAt: new Date(),
          },
        });

        await prisma.notification.create({
          data: {
            userId: log.user.id,
            title: `Log ${d.status.toLowerCase()} (bulk)`,
            message: `Your log "${log.taskTitle}" was ${d.status.toLowerCase()} by ${reviewer.name}.${d.comment ? ` Comment: ${d.comment}` : ""}`,
            type: d.status === "APPROVED" ? "SUCCESS" : d.status === "REJECTED" ? "WARNING" : "INFO",
            link: "/daily-log",
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: reviewer.id,
            action: `LOG_${d.status}`,
            detail: `Bulk review: Log ${log.id} (${log.taskTitle}) ${d.comment || "No comment"}`,
          },
        });

        ok++;
      } catch (e: any) {
        errors.push({ id: log.id, error: e?.message || "Unknown error" });
      }
    }

    return NextResponse.json({
      success: ok === decisions.length,
      reviewed: ok,
      total: decisions.length,
      errors,
    });
  } catch (error) {
    console.error("PATCH /api/staff-logs/bulk error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}