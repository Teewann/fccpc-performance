// src/app/api/daily-logs/pending-actions/route.ts
//
// Returns only the entries THIS user specifically needs to act on — not a
// system-wide list. Two categories share the ackStatus field: proxy entries
// logged on this user's behalf, and cross-department claims matching this
// user's department.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { department: { select: { name: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Category 1: proxy entries logged on this user's behalf
    const proxyPending = await prisma.dailyLog.findMany({
      where: { userId: user.id, loggedByProxy: true, ackStatus: "PENDING" },
      include: { proxyLoggedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Category 2: cross-department claims that name this user's department.
    const crossDeptPending = user.department
      ? await prisma.dailyLog.findMany({
          where: {
            crossDeptFlag: { contains: user.department.name, mode: "insensitive" },
            ackStatus: "PENDING",
            loggedByProxy: false,
          },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [];

    return NextResponse.json({
      proxyPending,
      crossDeptPending,
      total: proxyPending.length + crossDeptPending.length,
    });
  } catch (error) {
    console.error("Pending actions error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}