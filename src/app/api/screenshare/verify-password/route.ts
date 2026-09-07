// src/app/api/screenshare/verify-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { password } = await request.json();
    if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { password: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!user.password) return NextResponse.json({ verified: true });
    const valid = await bcrypt.compare(password, user.password);
    return NextResponse.json({ verified: valid });
  } catch (error) {
    console.error("[screenshare/verify-password]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
