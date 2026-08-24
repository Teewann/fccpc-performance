import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const goals = await prisma.orgGoal.findMany({
    include: { contributions: { include: { department: true } } },
    orderBy: { year: "desc" },
  });

  const enriched = goals.map((g) => {
    const totalCurrent = g.contributions.reduce((s, c) => s + c.current, 0);
    const pct = g.totalTarget > 0 ? Math.round((totalCurrent / g.totalTarget) * 100) : 0;
    return { ...g, totalCurrent, percentage: pct };
  });

  return NextResponse.json({ goals: enriched });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !["ADMIN", "EXECUTIVE"].includes(user.role))
    return NextResponse.json({ error: "Only Admin or Executive can create organisational goals." }, { status: 403 });

  const body = await request.json();
  const { title, description, totalTarget, unit, year, startDate, endDate, contributions } = body;
  // contributions: [{ departmentId, target, sourceType }]

  if (!title || !totalTarget || !unit || !year || !startDate || !endDate || !contributions?.length) {
    return NextResponse.json({ error: "All fields, plus at least one contributing department, are required." }, { status: 400 });
  }

  const goal = await prisma.orgGoal.create({
    data: {
      title, description: description || null, totalTarget: parseFloat(totalTarget),
      unit, year: parseInt(year), startDate: new Date(startDate), endDate: new Date(endDate),
      contributions: {
        create: contributions.map((c: any) => ({
          title: `${title} — contribution`,
          target: parseFloat(c.target),
          current: 0,
          unit,
          departmentId: c.departmentId,
          period: "ANNUAL",
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          sourceType: c.sourceType || "MANUAL",
        })),
      },
    },
    include: { contributions: { include: { department: true } } },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "ORG_GOAL_CREATED", detail: `Created goal "${title}" (${totalTarget} ${unit}) with ${contributions.length} contributing departments` },
  });

  return NextResponse.json({ success: true, goal }, { status: 201 });
}