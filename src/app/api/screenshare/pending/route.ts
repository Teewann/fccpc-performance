// src/app/api/screenshare/pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!currentUser) return NextResponse.json({ incoming: null });

    // Auto-expire stale pending sessions
    await prisma.screenShareSession.updateMany({
      where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 60_000) } },
      data: { status: "EXPIRED", endedAt: new Date() },
    });

    // ✅ FIXED: Use the correct relation names from your schema
    const incoming = await prisma.screenShareSession.findFirst({
      where: {
        targetId: currentUser.id,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      include: {
        User_ScreenShareSession_requesterIdToUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        User_ScreenShareSession_targetIdToUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!incoming) return NextResponse.json({ incoming: null });

    // ✅ FIXED: Use the correct property names
    return NextResponse.json({
      incoming: {
        ...incoming,
        requester: {
          ...incoming.User_ScreenShareSession_requesterIdToUser,
          image: null,
        },
        target: {
          ...incoming.User_ScreenShareSession_targetIdToUser,
          image: null,
        },
      },
    });
  } catch (error) {
    console.error("[screenshare/pending] Error:", error);
    return NextResponse.json({ error: "Server error", detail: String(error) }, { status: 500 });
  }
}