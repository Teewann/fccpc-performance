import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // ✅ Use session.user.id directly — no extra database round-trip
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ Run both queries in parallel (cuts latency in half)
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { notifId, markAllRead, deleteId, deleteAll } = body;

    if (deleteAll) {
      // Delete all READ notifications for this user
      await prisma.notification.deleteMany({
        where: { userId, read: true },
      });
    } else if (deleteId) {
      // Delete a single notification (only if it belongs to this user)
      await prisma.notification.deleteMany({
        where: { id: deleteId, userId },
      });
    } else if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    } else if (notifId) {
      await prisma.notification.updateMany({
        where: { id: notifId, userId },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}