// src/app/api/daily-logs/pending-actions/route.ts
// Returns logs that need acknowledgment from the current user (as supervisor).
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Find logs submitted by staff under this supervisor that need review
    const pending = await prisma.dailyLog.findMany({
      where: {
        supervisorId: userId,
        status: 'SUBMITTED',
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ pending });
  } catch (error) {
    console.error('[pending-actions]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}