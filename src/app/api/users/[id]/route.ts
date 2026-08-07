// src/app/api/memos/[id]/route.ts
// PATCH = mark as read
// DELETE = sender deletes
// POST = forward memo to new recipients (NEW)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─── PATCH — mark as read ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const memoId = params.id;

    const recipient = await prisma.memoRecipient.findFirst({
      where: { memoId, userId: user.id },
    });
    if (!recipient) return NextResponse.json({ error: "Not a recipient of this memo" }, { status: 403 });

    await prisma.memoRecipient.update({
      where: { id: recipient.id },
      data:  { read: true, readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── DELETE — sender deletes memo ────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const memo = await prisma.memo.findUnique({ where: { id: params.id } });
    if (!memo) return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    if (memo.senderId !== user.id) return NextResponse.json({ error: "Only the sender can delete this memo" }, { status: 403 });

    await prisma.memo.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── POST — FORWARD memo to new recipients ───────────────────────────
// This is the new forwarding feature.
// Anyone who received a memo can forward it onward with their own note.
// The system creates a NEW memo that references the original, preserving the chain.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where:   { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Must have received this memo OR be the sender to forward it
    const originalMemo = await prisma.memo.findUnique({
      where:   { id: params.id },
      include: {
        sender:     { select: { id: true, name: true, role: true } },
        recipients: { select: { userId: true } },
      },
    });
    if (!originalMemo) return NextResponse.json({ error: "Memo not found" }, { status: 404 });

    const isRecipient = originalMemo.recipients.some((r) => r.userId === user.id);
    const isSender    = originalMemo.senderId === user.id;
    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "You can only forward memos you have received or sent" }, { status: 403 });
    }

    const body = await request.json();
    const {
      forwardNote,      // the forwarder's own note/instruction
      targetType,       // "all" | "department" | "roles" | "specific"
      targetDeptId,
      targetRoles,
      recipientIds,
    } = body;

    if (!forwardNote?.trim()) {
      return NextResponse.json({ error: "A forwarding note is required" }, { status: 400 });
    }

    // ── Resolve recipients ────────────────────────────────────────────
    let recipientUserIds: string[] = [];

    if (targetType === "all") {
      const allUsers = await prisma.user.findMany({
        where:  { isActive: true, id: { not: user.id } },
        select: { id: true },
      });
      recipientUserIds = allUsers.map((u) => u.id);

    } else if (targetType === "department" && targetDeptId) {
      const deptUsers = await prisma.user.findMany({
        where:  { departmentId: targetDeptId, isActive: true, id: { not: user.id } },
        select: { id: true },
      });
      recipientUserIds = deptUsers.map((u) => u.id);

    } else if (targetType === "roles" && targetRoles?.length) {
      const roleUsers = await prisma.user.findMany({
        where:  { role: { in: targetRoles }, isActive: true, id: { not: user.id } },
        select: { id: true },
      });
      recipientUserIds = roleUsers.map((u) => u.id);

    } else if (targetType === "specific" && recipientIds?.length) {
      recipientUserIds = recipientIds.filter((id: string) => id !== user.id);

    } else {
      return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
    }

    if (recipientUserIds.length === 0) {
      return NextResponse.json({ error: "No valid recipients found" }, { status: 400 });
    }

    // ── Build the forwarded memo subject and body ─────────────────────
    // Preserve full chain in the body so recipients see the history
    const forwardedSubject = `FWD: ${originalMemo.subject}`;
    const forwardedBody    =
`${forwardNote}

────────────────────────────────────────
FORWARDED BY: ${user.name} (${user.department?.name || user.role})
DATE FORWARDED: ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
────────────────────────────────────────
ORIGINAL MEMO: ${originalMemo.subject}
ORIGINAL SENDER: ${originalMemo.sender.name}
ORIGINAL DATE: ${new Date(originalMemo.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
────────────────────────────────────────
${originalMemo.body}`;

    // ── Create the forwarded memo ─────────────────────────────────────
    const forwardedMemo = await prisma.memo.create({
      data: {
        subject:    forwardedSubject,
        body:       forwardedBody,
        senderId:   user.id,
        // Carry over attachment from original
        fileUrl:    originalMemo.fileUrl,
        fileName:   originalMemo.fileName,
        fileType:   originalMemo.fileType,
        recipients: {
          create: recipientUserIds.map((uid) => ({ userId: uid })),
        },
      },
    });

    // ── Notify all new recipients ─────────────────────────────────────
    await prisma.notification.createMany({
      data: recipientUserIds.map((uid) => ({
        userId:  uid,
        title:   `Forwarded Memo: ${originalMemo.subject}`,
        message: `${user.name} forwarded a memo to you: "${originalMemo.subject}". Original from: ${originalMemo.sender.name}.`,
        type:    "INFO",
        link:    "/announcements?tab=memos",
      })),
    });

    return NextResponse.json({ success: true, memo: { id: forwardedMemo.id } }, { status: 201 });
  } catch (error) {
    console.error("Memo forward error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}