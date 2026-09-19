import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { broadcastToConv } from "@/lib/broadcaster";
import { cache } from "@/lib/cache";

const MSG_SELECT = {
  id: true, conversationId: true,
  content: true, fileUrl: true, fileName: true, fileType: true,
  edited: true, pinned: true, createdAt: true,
  sender: { select: { id: true, name: true } },
  replyTo: { select: { id: true, content: true, fileName: true, sender: { select: { name: true } } } },
  reactions: { select: { id: true, emoji: true, userId: true, user: { select: { name: true } } } },
} as const;

// ── GET: paginated messages ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const convId  = req.nextUrl.searchParams.get("conversationId");
  const cursor  = req.nextUrl.searchParams.get("cursor"); // ISO timestamp for load-more
  const limit   = 60; // messages per page - fast and enough

  if (!convId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  // Single indexed lookup — very fast
  const member = await prisma.chatParticipant.findFirst({
    where: { conversationId: convId, userId },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Parallel: mark read + fetch messages + fetch participants
  const [messages, participants] = await Promise.all([
    prisma.chatMessage.findMany({
      where: {
        conversationId: convId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      select: MSG_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.chatParticipant.findMany({
      where: { conversationId: convId, userId: { not: userId } },
      select: { userId: true, lastReadAt: true, user: { select: { name: true, lastSeen: true } } },
    }),
    // Mark as read — fire and forget
    prisma.chatParticipant.update({
      where: { id: member.id }, data: { lastReadAt: new Date() },
    }).catch(() => {}),
    // Update lastSeen — fire and forget
    prisma.user.update({
      where: { id: userId }, data: { lastSeen: new Date() },
    }).catch(() => {}),
  ]);

  return NextResponse.json({
    messages: messages.reverse(), // oldest first
    participants,
    hasMore: messages.length === limit,
  });
}

// ── POST: send message ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const senderId = (session.user as any).id as string;

  const { conversationId, content, fileUrl, fileName, fileType, replyToId } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  if (!content && !fileUrl) return NextResponse.json({ error: "Nothing to send" }, { status: 400 });

  const member = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId: senderId },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Validate replyTo exists in this conversation
  const validReplyId = replyToId
    ? (await prisma.chatMessage.findFirst({
        where: { id: replyToId, conversationId }, select: { id: true },
      }))?.id ?? null
    : null;

  const message = await prisma.chatMessage.create({
    data: {
      conversationId, senderId,
      content: content ?? null, fileUrl: fileUrl ?? null,
      fileName: fileName ?? null, fileType: fileType ?? null,
      replyToId: validReplyId,
    },
    select: MSG_SELECT,
  });

  // Update conversation + mark sender read — parallel, fire and forget
  Promise.all([
    prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    prisma.chatParticipant.update({ where: { id: member.id }, data: { lastReadAt: new Date() } }),
  ]).catch(() => {});

  // Bust conversation list caches for all participants
  const allMembers = await prisma.chatParticipant.findMany({
    where: { conversationId }, select: { userId: true },
  });
  allMembers.forEach(p => cache.del(`convs:${p.userId}`));

  // Broadcast to all SSE subscribers — instant delivery
  broadcastToConv(conversationId, { type: "new_message", message });

  return NextResponse.json({ message });
}

// ── PATCH: edit message ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { messageId, content, pinned } = await req.json();
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only sender can edit content; any participant can pin
  if (content !== undefined && msg.senderId !== userId)
    return NextResponse.json({ error: "Not yours" }, { status: 403 });

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      ...(content !== undefined ? { content, edited: true } : {}),
      ...(pinned  !== undefined ? { pinned } : {}),
    },
    select: MSG_SELECT,
  });

  const eventType = content !== undefined ? "message_edited" : "pin_update";
  broadcastToConv(msg.conversationId, { type: eventType, message: updated });

  return NextResponse.json({ message: updated });
}

// ── DELETE: delete message ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const messageId = req.nextUrl.searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (msg.senderId !== userId) return NextResponse.json({ error: "Not yours" }, { status: 403 });

  await prisma.chatMessage.delete({ where: { id: messageId } });

  broadcastToConv(msg.conversationId, { type: "message_deleted", messageId });

  return NextResponse.json({ success: true });
}