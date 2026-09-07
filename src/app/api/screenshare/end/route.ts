// src/app/api/screenshare/end/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    
    const currentUser = await prisma.user.findUnique({ 
      where: { email: session.user.email }, 
      select: { id: true } 
    });
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    
    const { sessionId } = await request.json();
    if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    
    const existing = await prisma.screenShareSession.findUnique({ where: { id: sessionId } });
    if (!existing) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    
    if (existing.requesterId !== currentUser.id && existing.targetId !== currentUser.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    
    await prisma.screenShareSession.update({ 
      where: { id: sessionId }, 
      data: { 
        status: "ENDED", 
        endedAt: new Date(),
        updatedAt: new Date()
      } 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[screenshare/end]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}