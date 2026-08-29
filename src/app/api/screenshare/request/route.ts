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

    const { targetUserId } = await request.json();
    if (!targetUserId) {
      return NextResponse.json({ error: "Target user required" }, { status: 400 });
    }

    if (targetUserId === currentUser.id) {
      return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
    }

    const existing = await prisma.screenShareSession.findFirst({
      where: {
        OR: [
          { requesterId: currentUser.id, status: "PENDING" },
          { requesterId: currentUser.id, status: "ACTIVE" },
          { targetId: currentUser.id, status: "PENDING" },
          { targetId: currentUser.id, status: "ACTIVE" },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A session is already active. End it before starting a new one." },
        { status: 400 }
      );
    }

    const newSession = await prisma.screenShareSession.create({
      data: {
        requesterId: currentUser.id,
        targetId: targetUserId,
        status: "PENDING",
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        target: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    const normalised = {
      ...newSession,
      requester: { ...newSession.requester, image: null },
      target:    { ...newSession.target,    image: null },
    };

    return NextResponse.json({ session: normalised });
  } catch (error) {
    console.error("[screenshare/request] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
