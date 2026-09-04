"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import type { CallState, CallType } from "../components/types";

const INITIAL: CallState = {
  status: "idle", callType: null, remoteUser: null,
  conversationId: null, sessionId: null, isMuted: false, isCameraOff: false,
};

/**
 * WebRTC voice + video call hook.
 * Signaling via /api/chat/calls POST + SSE events from /api/chat/stream.
 * STUN: Google free servers. TURN: OpenRelay (free, no account).
 */
export function useCall(currentUserId: string) {
  const [call,         setCall]         = useState<CallState>(INITIAL);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pc         = useRef<RTCPeerConnection | null>(null);
  const iceServers = useRef<RTCIceServer[]>([]);

  // Fetch ICE config once
  useEffect(() => {
    fetch("/api/chat/calls")
      .then(r => r.json())
      .then(d => { if (d.iceServers) iceServers.current = d.iceServers; })
      .catch(() => {
        // Fallback to public Google STUN
        iceServers.current = [{ urls: "stun:stun.l.google.com:19302" }];
      });
  }, []);

  const createPC = useCallback(() => {
    if (pc.current) { pc.current.close(); pc.current = null; }

    const conn = new RTCPeerConnection({ iceServers: iceServers.current });

    conn.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const targetId = call.remoteUser?.id;
      if (!targetId) return;
      fetch("/api/chat/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ice", targetUserId: targetId, candidate, sessionId: call.sessionId }),
      }).catch(() => {});
    };

    conn.ontrack = (event) => {
      setRemoteStream(event.streams[0] ?? null);
    };

    conn.onconnectionstatechange = () => {
      if (conn.connectionState === "disconnected" || conn.connectionState === "failed") {
        hangup();
      }
    };

    pc.current = conn;
    return conn;
  }, [call.remoteUser, call.sessionId]);

  // Handle incoming SSE call events
  const handleCallEvent = useCallback(async (event: Record<string, unknown>) => {
    switch (event.type) {
      case "incoming_call": {
        const { sessionId, callType, caller, offer } = event as any;
        setCall(prev => ({
          ...prev, status: "incoming",
          callType, sessionId,
          remoteUser: caller,
          conversationId: null,
        }));
        // Store offer for when user accepts
        (window as any).__pendingOffer = offer;
        break;
      }
      case "call_answered": {
        const { answer, sessionId } = event as any;
        if (!pc.current) break;
        await pc.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCall(prev => ({ ...prev, status: "active" }));
        break;
      }
      case "ice_candidate": {
        const { candidate } = event as any;
        if (pc.current && candidate) {
          await pc.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
        break;
      }
      case "call_rejected": {
        hangup("rejected");
        break;
      }
      case "call_ended": {
        hangup("ended");
        break;
      }
    }
  }, []);

  // Initiate a call
  const startCall = useCallback(async (
    targetUser: { id: string; name: string; photo?: string | null },
    callType: CallType,
    conversationId: string,
  ) => {
    if (call.status !== "idle") return;
    const sessionId = `call_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video" ? { width: 640, height: 480 } : false,
    }).catch(() => null);

    if (!stream) { alert("Could not access camera/microphone."); return; }
    setLocalStream(stream);

    const conn = createPC();
    stream.getTracks().forEach(t => conn.addTrack(t, stream));

    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);

    setCall({ status: "calling", callType, remoteUser: targetUser, conversationId, sessionId, isMuted: false, isCameraOff: false });

    await fetch("/api/chat/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "call", targetUserId: targetUser.id, callType, offer, sessionId }),
    });
  }, [call.status, createPC]);

  // Accept an incoming call
  const acceptCall = useCallback(async () => {
    if (call.status !== "incoming") return;
    const offer = (window as any).__pendingOffer;
    if (!offer) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: call.callType === "video" ? { width: 640, height: 480 } : false,
    }).catch(() => null);

    if (!stream) { alert("Could not access camera/microphone."); return; }
    setLocalStream(stream);

    const conn = createPC();

    // Fix ICE candidates to reference remote user
    (conn as any).__targetId = call.remoteUser?.id;
    conn.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      fetch("/api/chat/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ice", targetUserId: call.remoteUser?.id, candidate, sessionId: call.sessionId }),
      }).catch(() => {});
    };

    stream.getTracks().forEach(t => conn.addTrack(t, stream));

    await conn.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);

    setCall(prev => ({ ...prev, status: "active" }));

    await fetch("/api/chat/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", callerId: call.remoteUser?.id, answer, sessionId: call.sessionId }),
    });

    delete (window as any).__pendingOffer;
  }, [call, createPC]);

  const rejectCall = useCallback(async () => {
    if (call.status !== "incoming") return;
    await fetch("/api/chat/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", callerId: call.remoteUser?.id, sessionId: call.sessionId }),
    }).catch(() => {});
    cleanup();
  }, [call]);

  const hangup = useCallback((reason = "ended") => {
    const targetId = call.remoteUser?.id;
    if (targetId && call.status !== "idle") {
      fetch("/api/chat/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hangup", targetUserId: targetId, sessionId: call.sessionId }),
      }).catch(() => {});
    }
    setCall(prev => ({ ...prev, status: reason === "idle" ? "idle" : "ended" }));
    setTimeout(() => { setCall(INITIAL); setRemoteStream(null); }, reason === "ended" ? 2000 : 0);
    cleanup();
  }, [call]);

  const cleanup = useCallback(() => {
    localStream?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    pc.current?.close();
    pc.current = null;
  }, [localStream]);

  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setCall(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCall(prev => ({ ...prev, isCameraOff: !prev.isCameraOff }));
  }, [localStream]);

  return {
    call, localStream, remoteStream,
    startCall, acceptCall, rejectCall,
    hangup, toggleMute, toggleCamera,
    handleCallEvent,
  };
}