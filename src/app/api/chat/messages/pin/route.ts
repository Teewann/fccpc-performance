import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH /api/chat/messages/pin
// Body: { messageId: string, pinned: boolean }
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await request.json();
  const { messageId, pinned } = body;
  if (!messageId || typeof pinned !== "boolean")
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Check message exists and user is a participant
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const participant = await prisma.chatParticipant.findFirst({
    where: { conversationId: message.conversationId, userId },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  // Update pinned field (requires schema migration — see note below)
  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { pinned },
    include: {
    sender: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ message: updated });
}
