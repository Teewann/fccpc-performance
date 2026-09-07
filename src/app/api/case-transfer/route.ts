// src/app/api/case-transfer/route.ts
//
// Full lifecycle for case transfers between zonal/HQ offices or departments,
// using your existing CaseTransfer model as-is. Mirrors the accept/reject/
// forward pattern already established in your Tasks page for consistency.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── GET — list transfers, scoped to what the requester should see ───────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "all"; // "initiated" | "incoming" | "all"
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    if (view === "initiated") {
      where.initiatedById = user.id;
    } else if (view === "incoming") {
      // Either specifically targeted at this person, or open to their
      // leadership role to pick up on behalf of their office/department.
      const canReceiveUnaddressed = ["DIRECTOR", "ADMIN", "HR", "SUPERVISOR"].includes(user.role);
      where.OR = [
        { targetUserId: user.id },
        ...(canReceiveUnaddressed ? [{ targetUserId: null }] : []),
      ];
    } else {
      where.OR = [{ initiatedById: user.id }, { targetUserId: user.id }, { acceptedById: user.id }];
    }

    const transfers = await prisma.caseTransfer.findMany({
      where,
      include: {
        initiatedBy: { select: { id: true, name: true, department: { select: { name: true } } } },
        acceptedBy: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const counts = {
      total: transfers.length,
      pendingAcceptance: transfers.filter((t) => t.status === "PENDING_ACCEPTANCE").length,
      inProgress: transfers.filter((t) => t.status === "IN_PROGRESS" || t.status === "ACCEPTED").length,
      completed: transfers.filter((t) => t.status === "COMPLETED").length,
    };

    return NextResponse.json({ transfers, counts });
  } catch (error) {
    console.error("Case transfer GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST — initiate a transfer ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      caseRef, caseTitle, caseType, description, fromOffice, toOffice,
      transferType, priority, transferNote, attachmentUrl, attachmentName,
      targetUserId, dueDate,
    } = body;

    if (!caseRef || !caseTitle || !caseType || !description || !fromOffice || !toOffice || !transferType || !transferNote) {
      return NextResponse.json({ error: "All core transfer fields are required" }, { status: 400 });
    }

    const transfer = await prisma.caseTransfer.create({
      data: {
        caseRef, caseTitle, caseType, description, fromOffice, toOffice,
        transferType, priority: priority || "MEDIUM", transferNote,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        initiatedById: user.id,
        targetUserId: targetUserId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    if (targetUserId) {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: "Case transfer received",
          message: `${user.name} transferred a case to you: "${caseTitle}" (${caseRef})`,
          type: "INFO",
          link: "/case-transfer",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CASE_TRANSFER_INITIATED",
        detail: `Transferred "${caseTitle}" (${caseRef}) from ${fromOffice} to ${toOffice}`,
      },
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (error) {
    console.error("Case transfer POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── PATCH — accept / reject / complete / recall / start progress ────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { transferId, action, rejectedReason, completedNote } = body;
    if (!transferId || !action) {
      return NextResponse.json({ error: "transferId and action are required" }, { status: 400 });
    }

    const transfer = await prisma.caseTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    const canReceive =
      transfer.targetUserId === user.id ||
      (!transfer.targetUserId && ["DIRECTOR", "ADMIN", "HR", "SUPERVISOR"].includes(user.role));
    const isInitiator = transfer.initiatedById === user.id;

    if (action === "accept") {
      if (!canReceive) return NextResponse.json({ error: "You're not the intended recipient of this transfer" }, { status: 403 });
      if (transfer.status !== "PENDING_ACCEPTANCE") return NextResponse.json({ error: "This transfer isn't awaiting acceptance" }, { status: 400 });
      const updated = await prisma.caseTransfer.update({
        where: { id: transferId },
        data: { status: "ACCEPTED", acceptedById: user.id, acceptedAt: new Date() },
      });
      await prisma.notification.create({
        data: { userId: transfer.initiatedById, title: "Case transfer accepted", message: `${user.name} accepted "${transfer.caseTitle}" (${transfer.caseRef})`, type: "SUCCESS", link: "/case-transfer" },
      });
      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action === "reject") {
      if (!canReceive) return NextResponse.json({ error: "You're not the intended recipient of this transfer" }, { status: 403 });
      if (!rejectedReason?.trim()) return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
      const updated = await prisma.caseTransfer.update({
        where: { id: transferId },
        data: { status: "REJECTED", rejectedReason },
      });
      await prisma.notification.create({
        data: { userId: transfer.initiatedById, title: "Case transfer rejected", message: `"${transfer.caseTitle}" (${transfer.caseRef}) was rejected: ${rejectedReason}`, type: "WARNING", link: "/case-transfer" },
      });
      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action === "start") {
      const isAcceptor = transfer.acceptedById === user.id;
      if (!isAcceptor) return NextResponse.json({ error: "Only the person who accepted this can start it" }, { status: 403 });
      if (transfer.status !== "ACCEPTED") return NextResponse.json({ error: "This transfer hasn't been accepted yet" }, { status: 400 });
      const updated = await prisma.caseTransfer.update({ where: { id: transferId }, data: { status: "IN_PROGRESS" } });
      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action === "complete") {
      const isAcceptor = transfer.acceptedById === user.id;
      if (!isAcceptor) return NextResponse.json({ error: "Only the person handling this transfer can complete it" }, { status: 403 });
      if (!["ACCEPTED", "IN_PROGRESS"].includes(transfer.status)) return NextResponse.json({ error: "This transfer isn't in a completable state" }, { status: 400 });
      const updated = await prisma.caseTransfer.update({
        where: { id: transferId },
        data: { status: "COMPLETED", completedAt: new Date(), completedNote: completedNote || null },
      });
      await prisma.notification.create({
        data: { userId: transfer.initiatedById, title: "Case transfer completed", message: `"${transfer.caseTitle}" (${transfer.caseRef}) was marked complete by ${user.name}`, type: "SUCCESS", link: "/case-transfer" },
      });
      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action === "recall") {
      if (!isInitiator) return NextResponse.json({ error: "Only the person who initiated this can recall it" }, { status: 403 });
      if (transfer.status !== "PENDING_ACCEPTANCE") return NextResponse.json({ error: "Can only recall a transfer that hasn't been accepted yet" }, { status: 400 });
      const updated = await prisma.caseTransfer.update({ where: { id: transferId }, data: { status: "RECALLED" } });
      return NextResponse.json({ success: true, transfer: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Case transfer PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
