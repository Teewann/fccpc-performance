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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Select only core fields guaranteed to exist on every User model.
    // Add `image: true` back to select if your User model has that field.
    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    // Normalise: add image as null so the UI doesn't crash on undefined
    const normalised = users.map((u) => ({ ...u, image: null }));

    return NextResponse.json({ users: normalised });
  } catch (error) {
    console.error("[screenshare/users] Error:", error);
    return NextResponse.json(
      { error: "Server error", detail: String(error) },
      { status: 500 }
    );
  }
}