import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST - mark a conversation as read (up to the current moment) for the logged-in user
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { conversationId } = body;
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const participant = await prisma.chatParticipant.findFirst({
    where: { conversationId, userId: user.id },
  });
  if (!participant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  await prisma.chatParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ success: true });
}