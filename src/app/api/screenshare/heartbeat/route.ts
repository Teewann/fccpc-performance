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

    // Find the active session where I am the TARGET — no sessionId needed from client
    const activeSession = await prisma.screenShareSession.findFirst({
      where: {
        targetId: currentUser.id,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSession) {
      // No active session — tell broadcaster to stop silently
      return NextResponse.json({ active: false });
    }

    // Write the heartbeat
    await prisma.screenShareHeartbeat.create({
      data: {
        sessionId:   activeSession.id,
        currentUrl:  currentUrl  || "/",
        pageTitle:   pageTitle   || "",
        scrollY:     scrollY     || 0,
        clickEvent:  clickEvent  || undefined,
        actionEvent: actionEvent || undefined,
        inputEvent:  inputEvent  || undefined,
      },
    });

    // Prune heartbeats older than 24h to keep the table clean
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
