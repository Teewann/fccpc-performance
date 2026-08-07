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

    const caller = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!caller) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (caller.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only Administrators can view the audit trail" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page     = parseInt(searchParams.get("page")     || "1");
    const limit    = parseInt(searchParams.get("limit")    || "30");
    const search   = searchParams.get("search")   || null;
    const action   = searchParams.get("action")   || null;
    const dateFrom = searchParams.get("dateFrom") || null;
    const dateTo   = searchParams.get("dateTo")   || null;

    const where: any = {
      ...(action && action !== "ALL" ? { action } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo   ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { detail: { contains: search, mode: "insensitive" } },
              { action: { contains: search, mode: "insensitive" } },
              { user: { name:  { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name:       true,
              email:      true,
              role:       true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}