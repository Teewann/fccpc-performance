// src/app/api/screenshare/heartbeat/route.ts
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

    const { currentUrl, pageTitle, scrollY, clickEvent, actionEvent, inputEvent } = await request.json();

    // Find the active session where I am the TARGET
    const activeSession = await prisma.screenShareSession.findFirst({
      where: {
        targetId: currentUser.id,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSession) {
      return NextResponse.json({ active: false });
    }

    // ✅ FIXED: Don't use nested connect - just use sessionId directly
    await prisma.screenShareHeartbeat.create({
      data: {
        id: `hb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sessionId: activeSession.id,
        currentUrl: currentUrl || "/",
        pageTitle: pageTitle || "",
        scrollY: scrollY || 0,
        clickEvent: clickEvent || undefined,
        actionEvent: actionEvent || undefined,
        inputEvent: inputEvent || undefined,
      },
    });

    // Prune heartbeats older than 24h
    await prisma.screenShareHeartbeat.deleteMany({
      where: {
        sessionId: activeSession.id,
        timestamp: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return NextResponse.json({ active: true });
  } catch (error) {
    console.error("[screenshare/heartbeat] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}