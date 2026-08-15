import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { faceImage } = await request.json();
    if (!faceImage) {
      return NextResponse.json({ error: "Face image required" }, { status: 400 });
    }

    // Check if user already has face enrolled
    const existing = await prisma.faceData.findFirst({
      where: { userId: user.id },
    });

    if (existing) {
      // Update existing face data
      await prisma.faceData.update({
        where: { id: existing.id },
        data: { faceImage },
      });
    } else {
      // Create new face data
      await prisma.faceData.create({
        data: {
          userId: user.id,
          faceImage,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Face enrollment error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const faceData = await prisma.faceData.findFirst({
      where: { userId: user.id },
    });

    return NextResponse.json({ hasFace: !!faceData });
  } catch (error) {
    console.error("Face check error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}