// lib/screenshare.ts
// ============================================================
// Core utilities for the Screen Share feature.
// Import these in your API routes and components.
// ============================================================

import { prisma } from '@/lib/prisma'; // adjust to your prisma client path

// How long (ms) before a PENDING request auto-expires
export const REQUEST_TIMEOUT_MS = 60_000; // 60 seconds

// How long (ms) without a heartbeat before session is considered dead
export const HEARTBEAT_TIMEOUT_MS = 15_000; // 15 seconds

// Polling interval recommendation for clients (ms)
export const POLL_INTERVAL_MS = 2_500;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClickEvent {
  x: number;
  y: number;
  selector: string;
  text: string;
  timestamp: number;
}

export interface ActionEvent {
  type: 'modal_open' | 'modal_close' | 'form_submit' | 'navigation' | 'button_click' | 'link_click';
  detail: string;
  timestamp: number;
}

export interface InputEvent {
  field: string;          // input name/id/placeholder
  maskedValue: string;    // e.g. "hello w****" — never raw password fields
  timestamp: number;
}

export interface HeartbeatPayload {
  currentUrl: string;
  pageTitle: string;
  clickEvent?: ClickEvent | null;
  actionEvent?: ActionEvent | null;
  inputEvent?: InputEvent | null;
  scrollY: number;
}

export interface SessionWithUsers {
  id: string;
  requesterId: string;
  targetId: string;
  status: string;
  startedAt: Date | null;
  createdAt: Date;
  requester: { id: string; name: string | null; email: string; role: string; image?: string | null };
  target:    { id: string; name: string | null; email: string; role: string; image?: string | null };
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/**
 * Find the active or pending session where userId is either party.
 * Returns null if no current session exists.
 */
export async function getCurrentSession(userId: string) {
  return prisma.screenShareSession.findFirst({
    where: {
      OR: [{ requesterId: userId }, { targetId: userId }],
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: {
      requester: { select: { id: true, name: true, email: true, role: true, image: true } },
      target:    { select: { id: true, name: true, email: true, role: true, image: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Expire any PENDING sessions older than REQUEST_TIMEOUT_MS.
 * Call this at the start of polling endpoints.
 */
export async function expireStaleRequests() {
  const cutoff = new Date(Date.now() - REQUEST_TIMEOUT_MS);
  await prisma.screenShareSession.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data:  { status: 'EXPIRED', endedAt: new Date() },
  });
}

/**
 * Write an audit log entry.
 * ✅ FIX: Use Prisma.JsonValue for metadata
 */
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
      // ✅ Convert to JSON-safe object
      metadata: metadata ? (metadata as any) : {} 
    },
  });
}

/**
 * Get the latest heartbeat for a session.
 */
export async function getLatestHeartbeat(sessionId: string) {
  return prisma.screenShareHeartbeat.findFirst({
    where: { sessionId },
    orderBy: { timestamp: 'desc' },
  });
}

/**
 * Mask sensitive input values so passwords are never transmitted.
 * Input names matching sensitive patterns are fully redacted.
 */
export function maskInputValue(fieldName: string, value: string): string {
  const sensitivePattern = /password|passwd|secret|token|pin|ssn|cvv|card/i;
  if (sensitivePattern.test(fieldName)) return '••••••••';
  // Mask the tail of anything longer than 4 chars
  if (value.length > 4) {
    return value.slice(0, 3) + '•'.repeat(Math.min(value.length - 3, 8));
  }
  return value;
}