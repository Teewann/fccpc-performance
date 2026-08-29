import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ session: null });
    }

    const sessionData = await prisma.screenShareSession.findFirst({
      where: {
        requesterId: currentUser.id,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        target: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!sessionData) {
      return NextResponse.json({ session: null });
    }

    const normalised = {
      ...sessionData,
      requester: { ...sessionData.requester, image: null },
      target:    { ...sessionData.target,    image: null },
    };

    if (sessionData.status !== "ACTIVE") {
      return NextResponse.json({ session: normalised, heartbeat: null, stale: false, secondsSinceLastBeat: null });
    }

    const heartbeat = await prisma.screenShareHeartbeat.findFirst({
      where: { sessionId: sessionData.id },
      orderBy: { timestamp: "desc" },
    });

    const stale = heartbeat
      ? Date.now() - new Date(heartbeat.timestamp).getTime() > 15000
      : true;

    const secondsSinceLastBeat = heartbeat
      ? Math.round((Date.now() - new Date(heartbeat.timestamp).getTime()) / 1000)
      : null;

    return NextResponse.json({
      session: normalised,
      heartbeat: heartbeat || null,
      stale,
      secondsSinceLastBeat,
    });
  } catch (error) {
    console.error("[screenshare/poll] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
