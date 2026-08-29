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

    const logs = await prisma.screenShareAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        session: {
          include: {
            requester: { select: { name: true, email: true } },
            target: { select: { name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[screenshare/audit] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
