import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET — fetch all KPIs, optionally filtered by department
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    const kpis = await prisma.kPI.findMany({
      where: departmentId ? { departmentId } : {},
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });

    // Compute status for each KPI
    const enriched = kpis.map((kpi) => {
      const pct = kpi.target > 0 ? (kpi.current / kpi.target) * 100 : 0;
      const now = new Date();
      const end = new Date(kpi.endDate);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const status =
        pct >= 90 ? "ON_TRACK" :
        pct >= 60 ? "AT_RISK"  : "BEHIND";
      return { ...kpi, percentage: Math.round(pct), status, daysLeft };
    });

    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ kpis: enriched, departments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — create a new KPI
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !["ADMIN", "DIRECTOR", "EXECUTIVE", "HR"].includes(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, target, unit, departmentId, period, startDate, endDate } = body;

    if (!title || !target || !unit || !departmentId || !startDate || !endDate) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const kpi = await prisma.kPI.create({
      data: {
        title,
        description: description || null,
        target: parseFloat(target),
        current: 0,
        unit,
        departmentId,
        period: period || "MONTHLY",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: { department: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "KPI_CREATED",
        detail: `KPI "${title}" created for dept ${departmentId}`,
      },
    });

    return NextResponse.json({ success: true, kpi }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH — update KPI progress
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { kpiId, current } = body;

    if (!kpiId || current === undefined) {
      return NextResponse.json({ error: "kpiId and current value required" }, { status: 400 });
    }

    const kpi = await prisma.kPI.update({
      where: { id: kpiId },
      data:  { current: parseFloat(current) },
      include: { department: true },
    });

    return NextResponse.json({ success: true, kpi });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — remove a KPI
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const kpiId = searchParams.get("id");
    if (!kpiId) return NextResponse.json({ error: "KPI id required" }, { status: 400 });

    await prisma.kPI.delete({ where: { id: kpiId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
