// src/app/api/screenshare/respond/route.ts
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

    const { sessionId, action } = await request.json();
    if (!sessionId || !action) {
      return NextResponse.json({ error: "Session ID and action required" }, { status: 400 });
    }

    const existing = await prisma.screenShareSession.findUnique({
      where: { id: sessionId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.targetId !== currentUser.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const status = action === "ACCEPT" ? "ACTIVE" : "REJECTED";

    const updated = await prisma.screenShareSession.update({
      where: { id: sessionId },
      data: {
        status,
        updatedAt: new Date(),
        ...(action === "ACCEPT" ? { startedAt: new Date() } : { endedAt: new Date() }),
      },
      include: {
        User_ScreenShareSession_requesterIdToUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        User_ScreenShareSession_targetIdToUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const normalised = {
      ...updated,
      requester: { ...updated.User_ScreenShareSession_requesterIdToUser, image: null },
      target: { ...updated.User_ScreenShareSession_targetIdToUser, image: null },
    };

    return NextResponse.json({ session: normalised });
  } catch (error) {
    console.error("[screenshare/respond] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}