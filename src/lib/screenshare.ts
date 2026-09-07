// src/lib/screenshare.ts
import prisma from '@/lib/prisma';

// ✅ REDUCED polling frequency to reduce DB load
export const REQUEST_TIMEOUT_MS   = 60_000;
export const HEARTBEAT_TIMEOUT_MS = 30_000; // Increased from 15s
export const POLL_INTERVAL_MS     = 5_000;  // Increased from 2.5s

export interface ClickEvent   { x: number; y: number; selector: string; text: string; timestamp: number; }
export interface ActionEvent  { type: string; detail: string; timestamp: number; }
export interface InputEvent   { field: string; maskedValue: string; timestamp: number; }
export interface HeartbeatPayload {
  currentUrl: string; pageTitle: string;
  clickEvent?: ClickEvent | null; actionEvent?: ActionEvent | null;
  inputEvent?: InputEvent | null; scrollY: number;
}

export async function getCurrentSession(userId: string) {
  return prisma.screenShareSession.findFirst({
    where: {
      OR: [{ requesterId: userId }, { targetId: userId }],
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: {
      User_ScreenShareSession_requesterIdToUser: {
        select: { id: true, name: true, email: true, role: true },
      },
      User_ScreenShareSession_targetIdToUser: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function expireStaleRequests() {
  const cutoff = new Date(Date.now() - REQUEST_TIMEOUT_MS);
  await prisma.screenShareSession.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data:  { status: 'EXPIRED', endedAt: new Date() },
  });
}

export async function auditLog(
  sessionId: string,
  action: string,
  actorId: string,
  metadata?: Record<string, unknown>
) {
  await prisma.screenShareAuditLog.create({
    data: {
      sessionId,
      action,
      actorId,
      metadata: metadata ? (metadata as any) : null,
    },
  });
}

export async function getLatestHeartbeat(sessionId: string) {
  return prisma.screenShareHeartbeat.findFirst({
    where: { sessionId },
    orderBy: { timestamp: 'desc' },
  });
}

export function maskInputValue(fieldName: string, value: string): string {
  if (/password|passwd|secret|token|pin|ssn|cvv|card/i.test(fieldName)) {
    return '••••••••';
  }
  if (value.length > 4) {
    return value.slice(0, 3) + '•'.repeat(Math.min(value.length - 3, 8));
  }
  return value;
}