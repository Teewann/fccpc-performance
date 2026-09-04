import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { broadcastToUser } from "@/lib/broadcaster";

/**
 * WebRTC Call Signaling via SSE
 * 
 * Flow:
 * 1. Caller POSTs { action:"call", targetUserId, callType, offer, sessionId }
 *    → SSE event "incoming_call" pushed to target
 * 2. Target POSTs { action:"answer", callerId, answer, sessionId }
 *    → SSE event "call_answered" pushed to caller
 * 3. Either side POSTs { action:"ice", targetUserId, candidate, sessionId }
 *    → SSE event "ice_candidate" pushed to target
 * 4. Either side POSTs { action:"hangup", targetUserId, sessionId }
 *    → SSE event "call_ended" pushed to target
 * 5. Target POSTs { action:"reject", callerId, sessionId }
 *    → SSE event "call_rejected" pushed to caller
 *
 * All signaling goes through SSE — no polling, instant delivery.
 * Uses free STUN servers (Google). TURN only needed for restrictive networks.
 */

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerId = (session.user as any).id as string;
  const callerName = session.user.name ?? "Someone";
  const callerPhoto = (session.user as any).photo ?? null;

  const body = await req.json();
  const { action, targetUserId, callType, offer, answer, candidate, sessionId, callerId: bodyCallerId } = body;

  switch (action) {
    case "call":
      // Broadcast incoming call to target user
      broadcastToUser(targetUserId, {
        type: "incoming_call",
        sessionId,
        callType: callType ?? "voice",
        caller: { id: callerId, name: callerName, photo: callerPhoto },
        offer,
      });
      return NextResponse.json({ ok: true });

    case "answer":
      // Broadcast answer back to caller
      broadcastToUser(bodyCallerId, {
        type: "call_answered",
        sessionId,
        answer,
        answerer: { id: callerId, name: callerName, photo: callerPhoto },
      });
      return NextResponse.json({ ok: true });

    case "reject":
      broadcastToUser(bodyCallerId, {
        type: "call_rejected",
        sessionId,
        rejectedBy: { id: callerId, name: callerName },
      });
      return NextResponse.json({ ok: true });

    case "ice":
      broadcastToUser(targetUserId, {
        type: "ice_candidate",
        sessionId,
        candidate,
        from: callerId,
      });
      return NextResponse.json({ ok: true });

    case "hangup":
      broadcastToUser(targetUserId, {
        type: "call_ended",
        sessionId,
        by: { id: callerId, name: callerName },
      });
      return NextResponse.json({ ok: true });

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

// ICE STUN servers config (served to client so it's easy to update)
export async function GET() {
  return NextResponse.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      // Free TURN from Open Relay Project (no account needed)
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  });
}