/**
 * In-process SSE broadcaster.
 * Works perfectly in a single-server deployment (Vercel, Railway, Render, VPS).
 * Zero cost — no Pusher, no Redis pub/sub needed.
 */

type Writer = (data: string) => void;

const subs = new Map<string, Set<Writer>>();

export function subscribe(channel: string, writer: Writer) {
  if (!subs.has(channel)) subs.set(channel, new Set());
  subs.get(channel)!.add(writer);
}

export function unsubscribe(channel: string, writer: Writer) {
  subs.get(channel)?.delete(writer);
  if (subs.get(channel)?.size === 0) subs.delete(channel);
}

export function broadcast(channel: string, event: object) {
  const writers = subs.get(channel);
  if (!writers?.size) return;
  const data = `data: ${JSON.stringify(event)}\n\n`;
  writers.forEach(w => { try { w(data); } catch {} });
}

// Call channels use a per-user channel: `call:${userId}`
export function broadcastToUser(userId: string, event: object) {
  broadcast(`user:${userId}`, event);
}

export function broadcastToConv(convId: string, event: object) {
  broadcast(`conv:${convId}`, event);
}