import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - fetch messages for a conversation
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const participant = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // Heartbeat + mark-as-read + fetch messages + fetch other participants — all at once
  const [, , messages, participants] = await Promise.all([
    prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } }).catch(() => {}),
    prisma.chatParticipant.update({ where: { id: participant.id }, data: { lastReadAt: new Date() } }).catch(() => {}),
    prisma.chatMessage.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, name: true, photo: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            fileName: true,
            sender: { select: { name: true } },
          },
        },
        reactions: {
          select: { id: true, emoji: true, userId: true, user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.chatParticipant.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true, lastReadAt: true, user: { select: { name: true, lastSeen: true } } },
    }),
  ]);

  return NextResponse.json({ messages, participants });
}

// POST - send a message (now supports replyToId)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const senderId = (session.user as any).id as string;

  const body = await request.json();
  const { conversationId, content, fileUrl, fileName, fileType, replyToId } = body;

  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  if (!content && !fileUrl) return NextResponse.json({ error: "Nothing to send" }, { status: 400 });

  // Participant check and reply-target validation are independent — run together
  const [participant, replyTarget] = await Promise.all([
    prisma.chatParticipant.findFirst({ where: { conversationId, userId: senderId } }),
    replyToId
      ? prisma.chatMessage.findFirst({ where: { id: replyToId, conversationId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const validReplyToId = replyTarget?.id || null;

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      content: content || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      replyToId: validReplyToId,
    },
    include: {
      sender: { select: { id: true, name: true, photo: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          fileName: true,
          sender: { select: { name: true } },
        },
      },
      reactions: true,
    },
  });

  // Sender's read marker + conversation's updatedAt — independent, run together
  await Promise.all([
    prisma.chatParticipant.update({ where: { id: participant.id }, data: { lastReadAt: new Date() } }).catch(() => {}),
    prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);

  return NextResponse.json({ message });
}

// PATCH - edit a message (only the sender can edit) - marks `edited: true`
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const senderId = (session.user as any).id as string;

  const body = await request.json();
  const { messageId, content } = body;
  if (!messageId || !content?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.senderId !== senderId) return NextResponse.json({ error: "Not your message" }, { status: 403 });

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content, edited: true },
    include: {
      sender: { select: { id: true, name: true, photo: true } },
      replyTo: { select: { id: true, content: true, fileName: true, sender: { select: { name: true } } } },
      reactions: true,
    },
  });

  return NextResponse.json({ message: updated });
}

// DELETE - delete a message (only the sender can delete)
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const senderId = (session.user as any).id as string;

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.senderId !== senderId) return NextResponse.json({ error: "Not your message" }, { status: 403 });

  await prisma.chatMessage.delete({ where: { id: messageId } });

  return NextResponse.json({ success: true });
}