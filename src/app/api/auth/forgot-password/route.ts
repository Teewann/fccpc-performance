import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim();

    // Case-insensitive lookup
    const user = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Fetch active admins
    let admins: { id: string }[] = [];
    try {
      admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: `Failed to fetch admins: ${err.message || err}` },
        { status: 500 }
      );
    }

    // Create notification for each active admin
    for (const admin of admins) {
      try {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Password reset request",
            message: `${user.name} (${user.email}) has requested a password reset. Go to User Management to reset their password.`,
            type: "WARNING",
          },
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: `Failed to create notification: ${err.message || err}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: `Unexpected error: ${error.message || error}` },
      { status: 500 }
    );
  }
}