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
    const userDeptId = (session.user as any).departmentId as string | null;

    const { searchParams } = new URL(request.url);

    // ✅ PAGINATION
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Staff see announcements for their department or all-staff announcements
    const where = {
      OR: [
        { targetDeptId: null },
        { targetDeptId: userDeptId ?? undefined },
      ],
    };

    // ✅ Run with pagination
    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          author: {
            select: { name: true, role: true, department: { select: { name: true } } },
          },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    return NextResponse.json({
      announcements,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
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
    const userId = (session.user as any).id as string;
    const userRole = (session.user as any).role as string;
    const userName = (session.user as any).name as string;

    // Only Directors, Admin, Executive can post
    if (!["DIRECTOR", "ADMIN", "EXECUTIVE"].includes(userRole)) {
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
        authorId:     userId,
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

    // Notification + audit log are independent — fire together
    await Promise.all([
      prisma.notification.createMany({
        data: targetUsers.map((u) => ({
          userId:  u.id,
          title:   `New announcement: ${title}`,
          message: `${userName} posted: "${title}"`,
          type:    "INFO" as const,
          link:    "/announcements",
        })),
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: "ANNOUNCEMENT_CREATED",
          detail: `Posted: "${title}"`,
        },
      }),
    ]);

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
    const userRole = (session.user as any).role as string;

    if (!["DIRECTOR", "ADMIN", "EXECUTIVE"].includes(userRole)) {
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