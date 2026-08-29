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
      return NextResponse.json({ incoming: null });
    }

    // Auto-expire PENDING sessions older than 60 seconds
    await prisma.screenShareSession.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 60_000) },
      },
      data: { status: "EXPIRED", endedAt: new Date() },
    });

    // Find any PENDING or ACTIVE session where I am the target
    const incoming = await prisma.screenShareSession.findFirst({
      where: {
        targetId: currentUser.id,
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

    // Normalise: add image:null so the UI component doesn't crash
    if (incoming) {
      const normalised = {
        ...incoming,
        requester: { ...incoming.requester, image: null },
        target:    { ...incoming.target,    image: null },
      };
      return NextResponse.json({ incoming: normalised });
    }

    return NextResponse.json({ incoming: null });
  } catch (error) {
    console.error("[screenshare/pending] Error:", error);
    return NextResponse.json(
      { error: "Server error", detail: String(error) },
      { status: 500 }
    );
  }
}