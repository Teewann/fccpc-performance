import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST — add or change my reaction on a message (one reaction per user per message, upsert)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { messageId, emoji } = body;
  if (!messageId || !emoji) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const participant = await prisma.chatParticipant.findFirst({
    where: { conversationId: message.conversationId, userId: user.id },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const reaction = await prisma.chatReaction.upsert({
    where: { messageId_userId: { messageId, userId: user.id } },
    update: { emoji },
    create: { messageId, userId: user.id, emoji },
  });

  return NextResponse.json({ reaction });
}

// DELETE — remove my reaction from a message
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  await prisma.chatReaction.deleteMany({
    where: { messageId, userId: user.id },
  });

  return NextResponse.json({ success: true });
}