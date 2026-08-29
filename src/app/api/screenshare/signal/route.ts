// src/app/api/screenshare/signal/route.ts
// Stores a WebRTC signal (offer/answer/ICE candidate) in the DB.
// Both peers poll /api/screenshare/signal/poll to receive signals.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { sessionId, toUserId, type, payload } = await request.json();

    if (!sessionId || !toUserId || !type || payload === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate this user is part of the session
    const shareSession = await prisma.screenShareSession.findFirst({
      where: {
        id: sessionId,
        OR: [{ requesterId: currentUser.id }, { targetId: currentUser.id }],
      },
    });
    if (!shareSession) {
      return NextResponse.json({ error: "Session not found or not authorized" }, { status: 403 });
    }

    await prisma.screenShareSignal.create({
      data: {
        sessionId,
        fromUserId: currentUser.id,
        toUserId,
        type,
        payload,
        consumed: false,
      },
    });

    // Clean up old consumed signals (older than 5 minutes)
    await prisma.screenShareSignal.deleteMany({
      where: {
        sessionId,
        consumed: true,
        createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[screenshare/signal] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}