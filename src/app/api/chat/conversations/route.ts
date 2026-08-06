import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET — list my conversations
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conversations = await prisma.chatConversation.findMany({
    where: {
      participants: { some: { userId: user.id } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, photo: true } } },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { content: true, fileUrl: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // inject lastMessage and extra info
  const result = conversations.map((c) => ({
    id: c.id,
    name: c.isGroup
      ? c.name
      : c.participants.find((p) => p.userId !== user.id)?.user.name || "Unknown",
    isGroup: c.isGroup,
    participants: c.participants.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      photo: p.user.photo,
    })),
    lastMessage: c.messages[0]?.content || (c.messages[0]?.fileUrl ? "📎 File" : ""),
    lastTime: c.messages[0]?.createdAt || c.createdAt,
  }));

  return NextResponse.json({ conversations: result });
}

// POST — create a new conversation (direct or group)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!currentUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { participantIds, isGroup, name } = body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return NextResponse.json({ error: "At least one participant required" }, { status: 400 });
  }

  // Ensure we don't create duplicates for direct chats (1-on-1)
  if (!isGroup && participantIds.length === 1) {
    const otherId = participantIds[0];
    const existingConv = await prisma.chatConversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: currentUser.id } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
    });
    if (existingConv) {
      return NextResponse.json({ conversation: existingConv });
    }
  }

  const userIds = [currentUser.id, ...participantIds];
  const conversation = await prisma.chatConversation.create({
    data: {
      name: isGroup ? name : null,
      isGroup: isGroup || false,
      participants: {
        create: userIds.map((id) => ({ userId: id })),
      },
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, photo: true } } } },
    },
  });

  return NextResponse.json({ conversation });
}
