import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { department: true },
    });

    if (!user?.departmentId) {
      return NextResponse.json({ templates: [] });
    }

    const templates = await prisma.taskTemplate.findMany({
      where: { departmentId: user.departmentId },
      orderBy: { category: "asc" },
    });

    return NextResponse.json({ templates, department: user.department });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

