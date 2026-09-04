import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { broadcastToConv } from "@/lib/broadcaster";

async function getReactions(messageId: string) {
  return prisma.chatReaction.findMany({
    where: { messageId },
    select: { id: true, emoji: true, userId: true, user: { select: { name: true } } },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { messageId, emoji } = await req.json();
  if (!messageId || !emoji) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId }, select: { conversationId: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.chatReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    update: { emoji },
    create: { messageId, userId, emoji },
  });

  const reactions = await getReactions(messageId);
  broadcastToConv(msg.conversationId, { type: "reaction_update", messageId, reactions });

  return NextResponse.json({ reactions });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const messageId = req.nextUrl.searchParams.get("messageId");
  if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 });

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId }, select: { conversationId: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.chatReaction.deleteMany({ where: { messageId, userId } });

  const reactions = await getReactions(messageId);
  broadcastToConv(msg.conversationId, { type: "reaction_update", messageId, reactions });

  return NextResponse.json({ reactions });
}