import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { subscribe, unsubscribe } from "@/lib/broadcaster";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as any).id as string;

  const convId = req.nextUrl.searchParams.get("conversationId");
  if (!convId) return new Response("conversationId required", { status: 400 });

  // Fast participant check — single indexed lookup
  const member = await prisma.chatParticipant.findFirst({
    where: { conversationId: convId, userId },
    select: { id: true },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  // Update lastSeen without blocking
  prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } }).catch(() => {});

  const enc = new TextEncoder();
  let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
      c.enqueue(enc.encode(": connected\n\n"));

      const write = (data: string) => {
        if (closed) return;
        try { ctrl!.enqueue(enc.encode(data)); } catch {}
      };

      // Subscribe to conversation events AND personal call events
      subscribe(`conv:${convId}`, write);
      subscribe(`user:${userId}`, write);

      // Heartbeat every 25s
      const hb = setInterval(() => {
        if (closed) { clearInterval(hb); return; }
        try { c.enqueue(enc.encode(": ♥\n\n")); } catch { clearInterval(hb); }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(hb);
        unsubscribe(`conv:${convId}`, write);
        unsubscribe(`user:${userId}`, write);
        try { c.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}