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

    // Run both queries in parallel — fast
    const [currentUser, allUsers] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Exclude self, add image: null for UI compatibility
    const users = allUsers
      .filter((u) => u.id !== currentUser.id)
      .map((u) => ({ ...u, image: null }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[screenshare/users] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}