import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cache } from "@/lib/cache";

// ── GET: list my conversations ──────────────────────────────────────
// ── GET: list my conversations ──────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const cacheKey = `convs:${userId}`;
  const cached = cache.get<object[]>(cacheKey);
  if (cached) return NextResponse.json({ conversations: cached });

  const convs = await prisma.chatConversation.findMany({
    where:   { participants: { some: { userId } } },
    select: {
      id: true, name: true, isGroup: true, updatedAt: true,
      // REMOVED: avatarUrl: true,  ← This field doesn't exist
      participants: {
        select: {
          userId: true, lastReadAt: true,
          user: { select: { id: true, name: true, photo: true, lastSeen: true, role: true } },
        },
      },
      messages: {
        take: 1, orderBy: { createdAt: "desc" },
        select: { content: true, fileUrl: true, createdAt: true, senderId: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = Date.now();
  const result = convs.map(c => {
    const me    = c.participants.find(p => p.userId === userId);
    const others = c.participants.filter(p => p.userId !== userId);
    const last  = c.messages[0];
    const isOnline = !c.isGroup && others[0]?.user?.lastSeen
      ? now - new Date(others[0].user.lastSeen).getTime() < 120_000
      : false;
    const hasUnread = !!last &&
      last.senderId !== userId &&
      (!me?.lastReadAt || new Date(last.createdAt) > new Date(me.lastReadAt));

    return {
      id: c.id,
      name: c.isGroup ? c.name : (others[0]?.user?.name ?? "Unknown"),
      isGroup: c.isGroup,
      // REMOVED: avatarUrl: c.avatarUrl ?? null,
      participants: c.participants.map(p => ({
        id: p.user.id, name: p.user.name,
        photo: p.user.photo, lastSeen: p.user.lastSeen?.toISOString() ?? null,
        role: p.user.role,
      })),
      lastMessage: last?.content ?? (last?.fileUrl ? "📎 File" : ""),
      lastTime: (last?.createdAt ?? c.updatedAt).toISOString(),
      isOnline, hasUnread,
    };
  });

  cache.set(cacheKey, result, 10_000); // 10-second cache
  return NextResponse.json({ conversations: result });
}

// ── POST: create conversation ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId   = (session.user as any).id as string;
  const myRole = (session.user as any).role as string;

  const { participantIds, isGroup, name } = await req.json();
  if (!Array.isArray(participantIds) || participantIds.length === 0)
    return NextResponse.json({ error: "At least one participant required" }, { status: 400 });

  // ── EVC permission gate ────────────────────────────────────────────
  // Staff cannot initiate a conversation with EVC
  const EXEC_ROLES = ["EXECUTIVE", "DIRECTOR", "ADMIN", "HR"];
  if (!EXEC_ROLES.includes(myRole) && !isGroup) {
    const targetUser = await prisma.user.findUnique({
      where: { id: participantIds[0] },
      select: { role: true },
    });
    if (targetUser?.role === "EXECUTIVE") {
      return NextResponse.json(
        { error: "You cannot initiate a chat with the EVC. The EVC will contact you if needed." },
        { status: 403 }
      );
    }
  }

  // ── Existing DM check ──────────────────────────────────────────────
  if (!isGroup && participantIds.length === 1) {
    const existing = await prisma.chatConversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: myId } } },
          { participants: { some: { userId: participantIds[0] } } },
        ],
      },
      select: { id: true, name: true, isGroup: true },
    });
    if (existing) {
      cache.del(`convs:${myId}`);
      return NextResponse.json({ conversation: existing });
    }
  }

  const allIds = [...new Set([myId, ...participantIds])];

  const conversation = await prisma.chatConversation.create({
    data: {
      name:    isGroup ? (name || "Group Chat") : null,
      isGroup: !!isGroup,
      participants: { create: allIds.map(id => ({ userId: id })) },
    },
    select: { id: true, name: true, isGroup: true },
  });

  // Bust caches for all participants
  allIds.forEach(id => cache.del(`convs:${id}`));

  return NextResponse.json({ conversation });
}

// ── PATCH: update group (name / avatar) ────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { conversationId, name, avatarUrl, addMemberIds } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const member = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // Update name / avatar
  const updated = await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      ...(name !== undefined      ? { name }      : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    },
    select: { id: true, name: true, isGroup: true, avatarUrl: true },
  });

  // Add new members
  if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
    const existingIds = (await prisma.chatParticipant.findMany({
      where: { conversationId }, select: { userId: true },
    })).map(p => p.userId);
    const newIds = addMemberIds.filter((id: string) => !existingIds.includes(id));
    if (newIds.length > 0) {
      await prisma.chatParticipant.createMany({
        data: newIds.map((id: string) => ({ conversationId, userId: id })),
        skipDuplicates: true,
      });
      newIds.forEach((id: string) => cache.del(`convs:${id}`));
    }
  }

  // Bust caches
  const allMembers = await prisma.chatParticipant.findMany({
    where: { conversationId }, select: { userId: true },
  });
  allMembers.forEach(p => cache.del(`convs:${p.userId}`));

  return NextResponse.json({ conversation: updated });
}