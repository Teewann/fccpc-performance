import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const notifications = await prisma.notification.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: "desc" },
      take:    100,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const { notifId, markAllRead, deleteId, deleteAll } = body;

    if (deleteAll) {
      // Delete all READ notifications for this user
      await prisma.notification.deleteMany({
        where: { userId: user.id, read: true },
      });
    } else if (deleteId) {
      // Delete a single notification (only if it belongs to this user)
      await prisma.notification.deleteMany({
        where: { id: deleteId, userId: user.id },
      });
    } else if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data:  { read: true },
      });
    } else if (notifId) {
      await prisma.notification.updateMany({
        where: { id: notifId, userId: user.id },
        data:  { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}