// src/app/api/daily-logs/[id]/acknowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    // ✅ Fix: Cast session.user to any to access id
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const { action, note } = await request.json(); // action: 'CONFIRM' | 'DISPUTE'
    if (!['CONFIRM', 'DISPUTE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const log = await prisma.dailyLog.findUnique({ where: { id } });
    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }

    // Only the assigned supervisor can acknowledge
    if (log.supervisorId !== userId) {
      // Admins can also acknowledge
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      if (!['ADMIN', 'DIRECTOR', 'EXECUTIVE'].includes(user?.role || '')) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // ✅ Fix: Map action to valid LogStatus values
    // CONFIRM → APPROVED, DISPUTE → QUERIED (since DISPUTED doesn't exist)
    const newStatus = action === 'CONFIRM' ? 'APPROVED' : 'QUERIED';
    
    const updated = await prisma.dailyLog.update({
      where: { id },
      data: { 
        status: newStatus,
        // ✅ Fix: Use supervisorComment or notes field (whichever exists in your schema)
        supervisorComment: note || null,
        // If your schema uses supervisorNote instead, use that:
        // supervisorNote: note || null,
      },
    });

    // Create audit entry
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: `LOG_${newStatus}`,
        detail: `Log ${id} ${newStatus}${note ? ` — ${note}` : ''}`,
      },
    });

    return NextResponse.json({ log: updated });
  } catch (error) {
    console.error('[acknowledge]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}