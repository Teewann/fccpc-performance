import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - list memos (received + sent, with read status)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const memos = await prisma.memo.findMany({
    where: {
      OR: [
        { senderId: userId },
        { recipients: { some: { userId } } },
      ],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
          department: { select: { name: true } },
        },
      },
      recipients: {
        select: {
          id: true,
          read: true,
          readAt: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Attach `_myRecipient` for the current user
  const enriched = memos.map((memo) => {
    const myRec = memo.recipients.find((r) => r.user.id === userId);
    return {
      ...memo,
      _myRecipient: myRec
        ? { id: myRec.id, read: myRec.read }
        : null,
    };
  });

  return NextResponse.json({ memos: enriched });
}

// POST - create a memo with audience logic
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const senderId = (session.user as any).id as string;
  const senderRole = (session.user as any).role as string;
  const senderName = (session.user as any).name as string;

  if (!["DIRECTOR", "HR", "ADMIN", "EXECUTIVE"].includes(senderRole)) {
    return NextResponse.json(
      { error: "You don't have permission to create memos" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    subject,
    body: memoBody,
    targetType,
    targetDeptId,
    targetRoles,
    recipientIds,
    fileUrl,
    fileName,
    fileType,
  } = body;

  if (!subject?.trim() || !memoBody?.trim()) {
    return NextResponse.json(
      { error: "Subject and body are required" },
      { status: 400 }
    );
  }

  let finalRecipientIds: string[] = [];

  if (targetType === "specific") {
    if (
      !recipientIds ||
      !Array.isArray(recipientIds) ||
      recipientIds.length === 0
    ) {
      return NextResponse.json(
        { error: "At least one recipient required" },
        { status: 400 }
      );
    }
    finalRecipientIds = recipientIds;
  } else if (targetType === "all") {
    const allUsers = await prisma.user.findMany({
      where: { isActive: true, id: { not: senderId } },
      select: { id: true },
    });
    finalRecipientIds = allUsers.map((u) => u.id);
  } else if (targetType === "roles") {
    if (!targetRoles || !Array.isArray(targetRoles)) {
      return NextResponse.json(
        { error: "Roles are required" },
        { status: 400 }
      );
    }
    const roleUsers = await prisma.user.findMany({
      where: {
        role: { in: targetRoles },
        isActive: true,
        id: { not: senderId },
      },
      select: { id: true },
    });
    finalRecipientIds = roleUsers.map((u) => u.id);
  } else if (targetType === "department") {
    if (!targetDeptId) {
      return NextResponse.json(
        { error: "Department ID is required" },
        { status: 400 }
      );
    }
    const deptUsers = await prisma.user.findMany({
      where: {
        departmentId: targetDeptId,
        isActive: true,
        id: { not: senderId },
      },
      select: { id: true },
    });
    finalRecipientIds = deptUsers.map((u) => u.id);
  }

  if (finalRecipientIds.length === 0) {
    return NextResponse.json(
      { error: "No valid recipients found" },
      { status: 400 }
    );
  }

  const memo = await prisma.memo.create({
    data: {
      subject: subject.trim(),
      body: memoBody.trim(),
      senderId,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileType: fileType || null,
      recipients: {
        create: finalRecipientIds.map((userId) => ({ userId })),
      },
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
          department: { select: { name: true } },
        },
      },
      recipients: {
        select: {
          id: true,
          read: true,
          readAt: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Notify recipients
    // Notify recipients
  await prisma.notification.createMany({
    data: finalRecipientIds.map((userId) => ({
      userId,
      title: `New Memo: ${subject}`,
      message: `From ${senderName}: ${memoBody.slice(0, 100)}...`,
      type: "INFO",
      link: "/announcements?tab=memos",
    })),
  });

  // ✅ AUDIT: record memo publication
  try {
    await prisma.auditLog.create({
      data: {
        userId: senderId,
        action: "MEMO_PUBLISHED",
        detail: `Published memo "${subject.trim()}" to ${finalRecipientIds.length} recipient(s) — target: ${targetType || "unspecified"}`,
      },
    });
  } catch (e) {
    console.error("[audit] memo log failed:", e);
  }

  return NextResponse.json({ success: true, memo });
}
