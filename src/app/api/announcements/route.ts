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
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Staff see announcements for their department or all-staff announcements
    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [
          { targetDeptId: null },
          { targetDeptId: user.departmentId ?? undefined },
        ],
      },
      include: {
        author: {
          select: { name: true, role: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only Directors, Admin, Executive can post
    if (!["DIRECTOR", "ADMIN", "EXECUTIVE"].includes(user.role)) {
      return NextResponse.json(
        { error: "Only Directors and Executives can post announcements" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, body: bodyText, targetDeptId, isPinned } = body;

    if (!title?.trim() || !bodyText?.trim()) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: {
        title:        title.trim(),
        body:         bodyText.trim(),
        authorId:     user.id,
        targetDeptId: targetDeptId || null,
        isPinned:     isPinned     || false,
      },
      include: {
        author: {
          select: { name: true, role: true, department: { select: { name: true } } },
        },
      },
    });

    // Notify all relevant staff
    const targetUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(targetDeptId ? { departmentId: targetDeptId } : {}),
      },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: targetUsers.map((u) => ({
        userId:  u.id,
        title:   `New announcement: ${title}`,
        message: `${user.name} posted: "${title}"`,
        type:    "INFO" as const,
        link:    "/announcements",
      })),
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ANNOUNCEMENT_CREATED",
        detail: `Posted: "${title}"`,
      },
    });

    return NextResponse.json({ success: true, announcement }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!["DIRECTOR", "ADMIN", "EXECUTIVE"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

