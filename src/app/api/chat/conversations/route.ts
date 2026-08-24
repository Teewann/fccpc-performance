import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - list my conversations
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  // Independent queries — run together instead of one after another
  const [conversations, myParticipantRows] = await Promise.all([
    prisma.chatConversation.findMany({
      where: {
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, photo: true, lastSeen: true } } },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { content: true, fileUrl: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.chatParticipant.findMany({
      where: { userId },
      select: { conversationId: true, lastReadAt: true },
    }),
  ]);

  const myReadMap = new Map(myParticipantRows.map((p) => [p.conversationId, p.lastReadAt]));

  // Consider someone "online" if seen in the last 2 minutes
  const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
  const now = Date.now();

  const result = conversations.map((c) => {
    const others = c.participants.filter((p) => p.userId !== userId);
    const otherUser = others[0]?.user;
    const isOnline = otherUser?.lastSeen
      ? now - new Date(otherUser.lastSeen).getTime() < ONLINE_THRESHOLD_MS
      : false;

    const lastMsg = c.messages[0];
    const myLastRead = myReadMap.get(c.id);
    const hasUnread = lastMsg
      ? lastMsg.senderId !== userId && (!myLastRead || new Date(lastMsg.createdAt) > new Date(myLastRead))
      : false;

    return {
      id: c.id,
      name: c.isGroup ? c.name : otherUser?.name || "Unknown",
      isGroup: c.isGroup,
      participants: c.participants.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        photo: p.user.photo,
        lastSeen: p.user.lastSeen,
      })),
      lastMessage: lastMsg?.content || (lastMsg?.fileUrl ? "📎 File" : ""),
      lastTime: lastMsg?.createdAt || c.createdAt,
      isOnline: c.isGroup ? undefined : isOnline,
      hasUnread,
    };
  });

  return NextResponse.json({ conversations: result });
}

// POST - create a new conversation (direct or group)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentUserId = (session.user as any).id as string;

  const body = await request.json();
  const { participantIds, isGroup, name } = body;

  if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
    return NextResponse.json({ error: "At least one participant required" }, { status: 400 });
  }

  if (!isGroup && participantIds.length === 1) {
    const otherId = participantIds[0];
    const existingConv = await prisma.chatConversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
    });
    if (existingConv) {
      return NextResponse.json({ conversation: existingConv });
    }
  }

  const userIds = [currentUserId, ...participantIds];
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