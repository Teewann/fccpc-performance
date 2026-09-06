import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ signals: [] }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!currentUser) return NextResponse.json({ signals: [] });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ signals: [] });

    // Get all unconsumed signals for me in this session
    const signals = await prisma.screenShareSignal.findMany({
      where: { sessionId, toUserId: currentUser.id, consumed: false },
      orderBy: { createdAt: "asc" },
    });

    // Mark consumed immediately
    if (signals.length > 0) {
      await prisma.screenShareSignal.updateMany({
        where: { id: { in: signals.map((s) => s.id) } },
        data: { consumed: true },
      });
    }

    return NextResponse.json({
      signals: signals.map((s) => ({
        id: s.id,
        type: s.type,
        payload: s.payload,
        fromUserId: s.fromUserId,
      })),
    });
  } catch (error) {
    console.error("[signal/poll] Error:", error);
    return NextResponse.json({ signals: [] });
  }
}
