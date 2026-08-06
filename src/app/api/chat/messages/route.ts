import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET — fetch messages for a conversation
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const participant = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId: user.id },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    include: {
      sender: { select: { id: true, name: true, photo: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ messages });
}

// POST — send a message
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sender = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!sender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { conversationId, content, fileUrl, fileName, fileType } = body;

  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  if (!content && !fileUrl) return NextResponse.json({ error: "Nothing to send" }, { status: 400 });

  const participant = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId: sender.id },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: sender.id,
      content: content || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
    },
    include: {
      sender: { select: { id: true, name: true, photo: true } },
    },
  });

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message });
}

// PATCH — edit a message (only the sender can edit)
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sender = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!sender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { messageId, content } = body;
  if (!messageId || !content?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.senderId !== sender.id) return NextResponse.json({ error: "Not your message" }, { status: 403 });

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { content },
    include: { sender: { select: { id: true, name: true, photo: true } } },
  });

  return NextResponse.json({ message: updated });
}

// DELETE — delete a message (only the sender can delete)
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sender = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!sender) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.senderId !== sender.id) return NextResponse.json({ error: "Not your message" }, { status: 403 });

  await prisma.chatMessage.delete({ where: { id: messageId } });

  return NextResponse.json({ success: true });
}