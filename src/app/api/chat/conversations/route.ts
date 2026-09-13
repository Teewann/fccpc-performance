import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { cache } from "@/lib/cache";

// Roles allowed to initiate chat with EVC
const EXEC_ROLES = new Set(["EXECUTIVE", "DIRECTOR", "ADMIN", "HR", "CHIEF"]);

// ── GET: list conversations with real unreadCount ──────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  // Short cache — 8 seconds is fine, SSE handles live updates
  const cacheKey = `convs:${userId}`;
  const cached = cache.get<object[]>(cacheKey);
  if (cached) return NextResponse.json({ conversations: cached });

  const convs = await prisma.chatConversation.findMany({
    where: { participants: { some: { userId } } },
    select: {
      id: true, name: true, isGroup: true, updatedAt: true,
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

  // Count unread per conversation in parallel — one query each, fast
  const unreadCounts = await Promise.all(
    convs.map(async (c) => {
      const me = c.participants.find(p => p.userId === userId);
      const myLastRead = me?.lastReadAt;
      const count = await prisma.chatMessage.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          ...(myLastRead ? { createdAt: { gt: myLastRead } } : {}),
        },
      });
      return { id: c.id, count };
    })
  );
  const unreadMap = new Map(unreadCounts.map(u => [u.id, u.count]));

  const result = convs.map(c => {
    const me     = c.participants.find(p => p.userId === userId);
    const others = c.participants.filter(p => p.userId !== userId);
    const last   = c.messages[0];
    const unreadCount = unreadMap.get(c.id) ?? 0;

    const isOnline = !c.isGroup && others[0]?.user?.lastSeen
      ? now - new Date(others[0].user.lastSeen).getTime() < 120_000
      : false;

    return {
      id: c.id,
      name: c.isGroup ? (c.name ?? "Group Chat") : (others[0]?.user?.name ?? "Unknown"),
      isGroup: c.isGroup,
      participants: c.participants.map(p => ({
        id: p.user.id, name: p.user.name,
        photo: p.user.photo,
        lastSeen: p.user.lastSeen?.toISOString() ?? null,
        role: p.user.role,
      })),
      lastMessage: last?.content ?? (last?.fileUrl ? "📎 File" : ""),
      lastTime: (last?.createdAt ?? c.updatedAt).toISOString(),
      isOnline,
      hasUnread: unreadCount > 0,
      unreadCount,          // ← FIXED: real number, not just boolean
    };
  });

  cache.set(cacheKey, result, 8_000);
  return NextResponse.json({ conversations: result });
}

// ── POST: create conversation ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId   = (session.user as any).id   as string;
  const myRole = (session.user as any).role as string;

  const { participantIds, isGroup, name } = await req.json();
  if (!Array.isArray(participantIds) || participantIds.length === 0)
    return NextResponse.json({ error: "At least one participant required" }, { status: 400 });

  // EVC restriction — staff can't chat EVC, directors/admins/HR can
  if (!isGroup && !EXEC_ROLES.has(myRole)) {
    const target = await prisma.user.findUnique({
      where: { id: participantIds[0] },
      select: { role: true, name: true },
    });
    if (target?.role === "EXECUTIVE" || target?.role === "CHIEF") {
      return NextResponse.json(
        { error: `You cannot initiate a chat with ${target.name}. They will contact you if needed.` },
        { status: 403 }
      );
    }
  }

  // Return existing DM instead of creating duplicate
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
      name: isGroup ? (name || "Group Chat") : null,
      isGroup: !!isGroup,
      participants: {
        createMany: {
          data: allIds.map(id => ({ userId: id })),
          skipDuplicates: true,
        },
      },
    },
    select: { id: true, name: true, isGroup: true },
  });

  allIds.forEach(id => cache.del(`convs:${id}`));
  return NextResponse.json({ conversation });
}

// ── PATCH: update group name / add members ────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { conversationId, name, addMemberIds } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const member = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId }, select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  const updated = await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { ...(name !== undefined ? { name } : {}) },
    select: { id: true, name: true, isGroup: true },
  });

  if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
    await prisma.chatParticipant.createMany({
      data: addMemberIds.map((id: string) => ({ conversationId, userId: id })),
      skipDuplicates: true,
    });
    addMemberIds.forEach((id: string) => cache.del(`convs:${id}`));
  }

  // Bust caches for all members
  const allMembers = await prisma.chatParticipant.findMany({
    where: { conversationId }, select: { userId: true },
  });
  allMembers.forEach(p => cache.del(`convs:${p.userId}`));

  return NextResponse.json({ conversation: updated });
}
