// FILE: src/app/api/settings/account/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { cache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Cache per-user for 60 seconds. This endpoint is called by Sidebar,
    // Topbar, and 10+ pages on every navigation — same user, same data.
    const cacheKey = `settings:account:${session.user.email}`;
    const cached = cache.get<{ user: unknown }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        jobTitle: true,
        role: true,
        staffId: true,
        gradeLevel: true,
        photo: true,
        userIdRef: true,
        departmentId: true,
        department: {
          select: {
            name: true,
          },
        },
        unit: {
          select: {
            name: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const payload = { user };
    cache.set(cacheKey, payload, 60_000);   // 60 seconds
    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      name,
      phone,
      jobTitle,
      currentPassword,
      newPassword,
    } = body;

    const updateData: any = {};

    if (name?.trim()) {
      updateData.name = name.trim();
    }

    if (phone?.trim()) {
      updateData.phone = phone.trim();
    }

    if (jobTitle?.trim()) {
      updateData.jobTitle = jobTitle.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          {
            error:
              "Current password is required to set a new password",
          },
          { status: 400 }
        );
      }

      const valid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          {
            error:
              "New password must be at least 8 characters",
          },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(
        newPassword,
        10
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No changes to save" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Invalidate the cache so the next GET returns fresh data
cache.del(`settings:account:${session.user.email}`);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ACCOUNT_UPDATED",
        detail: "User updated their profile",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}