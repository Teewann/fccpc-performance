import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET — download document attached to an EVC task
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

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

    const task = await prisma.eVCTask.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only the assignee or the EVC creator can download
    const canAccess = task.assignedToId === user.id || task.createdById === user.id || user.role === "EXECUTIVE";
    if (!canAccess) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    if (!task.documentData) {
      return NextResponse.json({ error: "No document attached" }, { status: 404 });
    }

    return NextResponse.json({
      success:  true,
      fileData: task.documentData,
      fileName: task.documentName,
      fileType: task.documentType,
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}