// src/app/api/daily-logs/[id]/acknowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { action, note } = await request.json(); // action: 'CONFIRM' | 'DISPUTE'
    if (!['CONFIRM', 'DISPUTE'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const log = await prisma.dailyLog.findUnique({ where: { id: params.id } });
    if (!log) return NextResponse.json({ error: 'Log not found' }, { status: 404 });

    // Only the assigned supervisor can acknowledge
    if (log.supervisorId !== session.user.id) {
      // Admins can also acknowledge
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (!['ADMIN', 'DIRECTOR', 'EXECUTIVE'].includes(user?.role || '')) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const newStatus = action === 'CONFIRM' ? 'APPROVED' : 'DISPUTED';
    const updated = await prisma.dailyLog.update({
      where: { id: params.id },
      data: { status: newStatus, supervisorNote: note || null },
    });

    // Create audit entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `LOG_${newStatus}`,
        details: { logId: params.id, note: note || null },
      },
    });

    return NextResponse.json({ log: updated });
  } catch (error) {
    console.error('[acknowledge]', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
