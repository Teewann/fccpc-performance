import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const userId = (session.user as any).id as string;

    const recipient = await prisma.memoRecipient.findFirst({
      where: { memoId: id, userId },
    });
    if (!recipient) return NextResponse.json({ error: "Not a recipient" }, { status: 403 });
    await prisma.memoRecipient.update({
      where: { id: recipient.id },
      data: { read: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const userId = (session.user as any).id as string;

    const memo = await prisma.memo.findUnique({ where: { id } });
    if (!memo) return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    if (memo.senderId !== userId)
      return NextResponse.json({ error: "Only sender can delete" }, { status: 403 });
    await prisma.memo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const userId = (session.user as any).id as string;
    const userName = (session.user as any).name as string;

    const original = await prisma.memo.findUnique({
      where: { id },
      include: { sender: true, recipients: true },
    });
    if (!original) return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    const isRecipient = original.recipients.some((r: any) => r.userId === userId);
    const isSender = original.senderId === userId;
    if (!isRecipient && !isSender)
      return NextResponse.json({ error: "Not allowed to forward" }, { status: 403 });
    const body = await request.json();
    const { forwardNote, targetType, targetDeptId, targetRoles, recipientIds } = body;
    if (!forwardNote?.trim())
      return NextResponse.json({ error: "Forwarding note required" }, { status: 400 });
    let toUserIds: string[] = [];
    if (targetType === "all") {
      const all = await prisma.user.findMany({ where: { isActive: true, id: { not: userId } }, select: { id: true } });
      toUserIds = all.map(u => u.id);
    } else if (targetType === "department") {
      if (!targetDeptId) return NextResponse.json({ error: "Department required" }, { status: 400 });
      const deptUsers = await prisma.user.findMany({ where: { departmentId: targetDeptId, isActive: true, id: { not: userId } }, select: { id: true } });
      toUserIds = deptUsers.map(u => u.id);
    } else if (targetType === "roles") {
      if (!targetRoles?.length) return NextResponse.json({ error: "Roles required" }, { status: 400 });
      const roleUsers = await prisma.user.findMany({ where: { role: { in: targetRoles }, isActive: true, id: { not: userId } }, select: { id: true } });
      toUserIds = roleUsers.map(u => u.id);
    } else if (targetType === "specific") {
      if (!recipientIds?.length) return NextResponse.json({ error: "Recipients required" }, { status: 400 });
      toUserIds = recipientIds.filter((uid: string) => uid !== userId);
    } else {
      return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
    }
    if (toUserIds.length === 0) return NextResponse.json({ error: "No recipients" }, { status: 400 });
    const forwardedBody = `${forwardNote.trim()}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFORWARDED BY: ${userName}\nDATE: ${new Date().toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nORIGINAL MEMO: ${original.subject}\nFROM: ${original.sender.name}\nDATED: ${new Date(original.createdAt).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${original.body}`;
    const forwarded = await prisma.memo.create({
      data: {
        subject: `FWD: ${original.subject}`,
        body: forwardedBody,
        senderId: userId,
        fileUrl: (original as any).fileUrl || null,
        fileName: (original as any).fileName || null,
        fileType: (original as any).fileType || null,
        recipients: { create: toUserIds.map(uid => ({ userId: uid })) },
      },
    });
    // Notifications (non-fatal)
    try {
      await prisma.notification.createMany({
        data: toUserIds.map(uid => ({
          userId: uid,
          title: `Forwarded: ${original.subject}`,
          message: `${userName} forwarded a memo to you: "${original.subject}"`,
          type: "INFO",
        })),
      });
    } catch (e) { console.error(e); }
    return NextResponse.json({ success: true, memo: forwarded }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}