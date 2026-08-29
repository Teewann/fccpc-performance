'use client';
// src/components/screenshare/ScreenShareWebRTC.tsx
// Professional fallback chain: Screen → Camera (automatic, no blocking)

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useScreenShare } from '@/components/screenshare/ScreenShareProvider';

// ── Config ────────────────────────────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // For remote/home users uncomment (free TURN):
  // { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
];
const POLL_MS = 400;

// ── Signal helpers ────────────────────────────────────────────────────────────
async function sendSignal(sessionId: string, toUserId: string, type: string, payload: unknown) {
  try {
    await fetch('/api/screenshare/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, toUserId, type, payload }),
    });
  } catch {}
}

async function pollSignals(sessionId: string) {
  try {
    const res = await fetch(`/api/screenshare/signal/poll?sessionId=${sessionId}`);
    const data = await res.json();
    return (data.signals || []) as { id: string; type: string; payload: unknown; fromUserId: string }[];
  } catch { return []; }
}

// ── Draggable hook ────────────────────────────────────────────────────────────
function useDraggable(ix: number, iy: number) {
  const [pos, setPos] = useState({ x: ix, y: iy });
  const drag = useRef(false);
  const off = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('[data-drag]')) return;
    drag.current = true;
    off.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!(e.target as HTMLElement).closest('[data-drag]')) return;
    drag.current = true;
    off.current = { x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    const mm = (e: MouseEvent) => { if (drag.current) setPos({ x: Math.max(0, e.clientX - off.current.x), y: Math.max(0, e.clientY - off.current.y) }); };
    const tm = (e: TouchEvent) => { if (drag.current) setPos({ x: Math.max(0, e.touches[0].clientX - off.current.x), y: Math.max(0, e.touches[0].clientY - off.current.y) }); };
    const up = () => { drag.current = false; };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', tm, { passive: true }); window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', up);
    };
  }, []);

  return { pos, onMouseDown, onTouchStart };
}

// ── TARGET HOOK ───────────────────────────────────────────────────────────────
function useWebRTCTarget(sessionId: string | null, viewerUserId: string | null, active: boolean) {
  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef   = useRef<NodeJS.Timeout | null>(null);
  const [sharing,     setSharing]     = useState(false);
  const [shareType,   setShareType]   = useState<'screen' | 'camera' | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const stop = useCallback((sendEnd = false) => {
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null; streamRef.current = null;
    setSharing(false); setShareType(null);
    if (sendEnd && sessionId && viewerUserId) sendSignal(sessionId, viewerUserId, 'end', {});
  }, [sessionId, viewerUserId]);

  // Connect stream to WebRTC peer — called after we have a stream from any source
  const connectStream = useCallback(async (stream: MediaStream, type: 'screen' | 'camera') => {
    if (!sessionId || !viewerUserId) { stream.getTracks().forEach(t => t.stop()); return; }
    streamRef.current = stream;
    setSharing(true); setShareType(type); setError(null);

    // Stop sharing if user clicks browser's native "Stop sharing" button
    stream.getVideoTracks()[0].onended = () => stop(true);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => { if (e.candidate) sendSignal(sessionId, viewerUserId, 'ice-candidate', e.candidate.toJSON()); };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(sessionId, viewerUserId, 'offer', { type: offer.type, sdp: offer.sdp });

    // Poll for viewer's answer
    pollRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      const sigs = await pollSignals(sessionId);
      for (const sig of sigs) {
        if (sig.type === 'answer' && pcRef.current?.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.payload as any));
        }
        if (sig.type === 'ice-candidate' && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.payload as any)).catch(() => {});
        }
        if (sig.type === 'end') stop(false);
      }
    }, POLL_MS);
  }, [sessionId, viewerUserId, stop]);

  useEffect(() => { if (!active) stop(false); }, [active]);
  useEffect(() => () => stop(false), [stop]);

  return { sharing, shareType, error, setError, connectStream, stop };
}

// ── VIEWER HOOK ───────────────────────────────────────────────────────────────
function useWebRTCViewer(
  sessionId: string | null,
  targetUserId: string | null,
  active: boolean,
  onStream: (s: MediaStream | null) => void
) {
  const pcRef   = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected] = useState(false);
  const [waiting,   setWaiting]   = useState(false);

  const stop = useCallback((sendEnd = false) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pcRef.current?.close(); pcRef.current = null;
    setConnected(false); setWaiting(false); onStream(null);
    if (sendEnd && sessionId && targetUserId) sendSignal(sessionId, targetUserId, 'end', {});
  }, [sessionId, targetUserId, onStream]);

  useEffect(() => {
    if (!active || !sessionId || !targetUserId) { if (!active) stop(false); return; }
    setWaiting(true);

    pollRef.current = setInterval(async () => {
      const sigs = await pollSignals(sessionId!);
      for (const sig of sigs) {
        if (sig.type === 'offer' && !pcRef.current) {
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;
          pc.ontrack = e => { onStream(e.streams[0] || new MediaStream([e.track])); setConnected(true); setWaiting(false); };
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') { setConnected(true); setWaiting(false); }
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setConnected(false);
          };
          pc.onicecandidate = e => { if (e.candidate) sendSignal(sessionId!, targetUserId!, 'ice-candidate', e.candidate.toJSON()); };
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as any));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(sessionId!, targetUserId!, 'answer', { type: answer.type, sdp: answer.sdp });
        }
        if (sig.type === 'ice-candidate' && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.payload as any)).catch(() => {});
        }
        if (sig.type === 'end') stop(false);
      }
    }, POLL_MS);

    return () => stop(false);
  }, [active, sessionId, targetUserId]);

  useEffect(() => () => stop(false), [stop]);
  return { connected, waiting, stop };
}

// ── INCOMING MODAL — centered, draggable ──────────────────────────────────────
export function ScreenShareIncomingModalWebRTC() {
  const { incomingRequest, respondToRequest } = useScreenShare();
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const cx = typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 300;
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 - 200 : 200;
  const { pos, onMouseDown, onTouchStart } = useDraggable(cx, cy);
  const mob = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (!incomingRequest) return;
    setCountdown(60);
    const t = setInterval(() => setCountdown(c => c <= 1 ? (clearInterval(t), 0) : c - 1), 1000);
    return () => clearInterval(t);
  }, [incomingRequest?.id]);

  const respond = async (action: 'ACCEPT' | 'REJECT') => {
    if (!incomingRequest) return;
    setLoading(true);
    try { await respondToRequest(incomingRequest.id, action); } finally { setLoading(false); }
  };

  if (!incomingRequest || incomingRequest.status !== 'PENDING') return null;
  const req = incomingRequest.requester;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: mob ? 'center' : undefined, justifyContent: mob ? 'center' : undefined }}>
      <div
        style={{ position: mob ? 'relative' : 'fixed', left: mob ? undefined : pos.x, top: mob ? undefined : pos.y, width: mob ? 'calc(100vw - 32px)' : 400, maxWidth: 420, background: '#0d1526', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden', userSelect: 'none' }}
        onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      >
        <div data-drag="1" style={{ padding: '16px 20px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.1)', cursor: mob ? 'default' : 'grab', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👁️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>Screen View Request</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Auto-declines in <strong style={{ color: countdown > 20 ? '#4ade80' : countdown > 10 ? '#f59e0b' : '#ef4444' }}>{countdown}s</strong> {!mob && '· Drag to move'}</div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.08)', marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
              {(req.name || req.email)[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff' }}>{req.name || req.email}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{req.role}</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 12 }}>
            Wants to view your screen live. You will choose exactly what to share.
          </p>
          <div style={{ padding: '9px 12px', borderRadius: 8, marginBottom: 14, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', fontSize: 12, color: '#a16207' }}>
            ⚠ <strong>You stay in control.</strong> Stop anytime with the red badge at the top.
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(148,163,184,0.1)', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: countdown > 20 ? '#22c55e' : countdown > 10 ? '#f59e0b' : '#ef4444', width: `${(countdown / 60) * 100}%`, transition: 'width 1s linear, background 0.3s' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => respond('REJECT')} disabled={loading} style={{ flex: 1, padding: 13, borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 48 }}>
              Decline
            </button>
            <button onClick={() => respond('ACCEPT')} disabled={loading} style={{ flex: 1, padding: 13, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.3)', minHeight: 48 }}>
              {loading ? 'Accepting…' : '✓ Accept & Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SHARE PICKER MODAL ────────────────────────────────────────────────────────
// Shows on ALL devices — no blocking. Attempts screen first, auto-falls to camera.
function SharePickerModal({
  viewerName,
  onScreen,
  onCamera,
  onCancel,
  error,
}: {
  viewerName: string;
  onScreen:  () => void;
  onCamera:  () => void;
  onCancel:  () => void;
  error:     string | null;
}) {
  const mob = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#0d1526', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📡</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Share Your Visuals</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}><strong style={{ color: '#4ade80' }}>{viewerName}</strong> will see this live</div>
          </div>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', fontSize: 13, color: '#fbbf24', lineHeight: 1.5 }}>
              ⚠ {error}
            </div>
          )}

          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            Choose how you want to share. Screen sharing works on modern browsers — camera is available as an alternative on any device.
          </p>

          {/* Screen share option */}
          <button
            onClick={onScreen}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', marginBottom: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', color: 'inherit', minHeight: 72 }}
          >
            <span style={{ fontSize: 28, flexShrink: 0 }}>🖥️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>Share Screen</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Share a tab, window, or your entire screen</div>
              <div style={{ fontSize: 11, color: '#4ade80', marginTop: 3 }}>Recommended · Works on Chrome, Edge, Firefox</div>
            </div>
            <span style={{ color: '#4ade80', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>

          {/* Camera option */}
          <button
            onClick={onCamera}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', marginBottom: 16, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', color: 'inherit', minHeight: 72 }}
          >
            <span style={{ fontSize: 28, flexShrink: 0 }}>📸</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>Share Camera</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Point your camera at a screen, document, or whiteboard</div>
              <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 3 }}>Works on all devices including phones & tablets</div>
            </div>
            <span style={{ color: '#60a5fa', fontSize: 20, flexShrink: 0 }}>›</span>
          </button>

          <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginBottom: 14, lineHeight: 1.5 }}>
            🔒 Encrypted peer-to-peer · Not recorded by server
          </p>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={onCancel} style={{ padding: '10px 32px', borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer', minHeight: 44 }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TARGET COMPONENT ──────────────────────────────────────────────────────────
export function TargetScreenShareWebRTC() {
  const { mySession, iAmTarget, isActive, endSession } = useScreenShare();
  const viewerUserId = mySession?.requesterId ?? null;
  const sessionId    = mySession?.id ?? null;
  const viewerName   = mySession?.requester?.name || mySession?.requester?.email || 'Someone';

  const { sharing, shareType, error, setError, connectStream, stop } = useWebRTCTarget(sessionId, viewerUserId, iAmTarget && isActive);
  const [showPicker, setShowPicker] = useState(false);

  // Show picker as soon as session is active — no device blocking at all
  useEffect(() => {
    if (iAmTarget && isActive && !sharing && !showPicker) setShowPicker(true);
    if (!isActive) setShowPicker(false);
  }, [iAmTarget, isActive]);

  const handleStop = async () => { stop(true); await endSession(); };

  // ── Screen share attempt — getDisplayMedia MUST be first await after click
  const handleShareScreen = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } } as any,
        audio: false,
      });
      setShowPicker(false);
      await connectStream(stream, 'screen');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled — just re-show picker, don't error
        setShowPicker(true);
      } else {
        // API not supported on this browser — auto fall to camera
        setError('Screen sharing not supported on this browser. Try sharing your camera instead.');
        setShowPicker(true);
      }
    }
  };

  // ── Camera share — works on every device with a camera
  const handleShareCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setShowPicker(false);
      await connectStream(stream, 'camera');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permission and try again.');
      } else {
        setError('Could not access camera: ' + (err.message || 'Unknown error'));
      }
    }
  };

  if (!iAmTarget || !isActive) return null;

  return (
    <>
      {/* Picker modal — shown on ALL devices */}
      {showPicker && (
        <SharePickerModal
          viewerName={viewerName}
          onScreen={handleShareScreen}
          onCamera={handleShareCamera}
          onCancel={handleStop}
          error={error}
        />
      )}

      {/* Status badge — top center */}
      {!showPicker && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px', borderRadius: 100,
          background: 'rgba(10,15,30,0.95)',
          border: `1px solid ${error ? 'rgba(234,179,8,0.4)' : sharing ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.3)'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          fontSize: 13, color: '#f0f4ff', backdropFilter: 'blur(12px)',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          {error ? (
            <><span>⚠️</span><span style={{ color: '#fbbf24', fontSize: 12 }}>{error}</span><button onClick={() => setShowPicker(true)} style={bs.stop}>Retry</button></>
          ) : sharing ? (
            <>
              <span style={bs.dot} />
              <span>
                {shareType === 'camera' ? '📸' : '🖥️'}
                {' '}Live — <strong style={{ color: '#4ade80' }}>{viewerName}</strong> is watching
              </span>
              <button onClick={handleStop} style={bs.stop}>Stop</button>
            </>
          ) : (
            <><div style={bs.spin} /><span style={{ color: '#94a3b8' }}>Preparing…</span><button onClick={handleStop} style={bs.stop}>Cancel</button></>
          )}
        </div>
      )}
    </>
  );
}

// ── VIEWER COMPONENT ──────────────────────────────────────────────────────────
export function ViewerScreenShareWebRTC() {
  const { mySession, iAmViewer, iAmTarget, isActive, endSession, showViewerPanel, setShowViewerPanel } = useScreenShare();
  const [stream,       setStream]       = useState<MediaStream | null>(null);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mob = typeof window !== 'undefined' && window.innerWidth < 768;
  const initX = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 700) : 100;
  const initY = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 480) : 100;
  const { pos, onMouseDown, onTouchStart } = useDraggable(initX, initY);

  const sessionId    = mySession?.id ?? null;
  const targetUserId = mySession?.targetId ?? null;
  const { connected, waiting, stop } = useWebRTCViewer(sessionId, targetUserId, iAmViewer && isActive, setStream);

  // Robust video attachment
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = null; v.srcObject = stream; v.muted = true;
    const play = () => v.play().catch(() => setTimeout(() => v.play().catch(() => {}), 200));
    if (v.readyState >= 2) play(); else v.onloadeddata = play;
    return () => { v.onloadeddata = null; };
  }, [stream]);

  const handleEnd = async () => { stop(true); await endSession(); };

  // Mirror fix: don't render viewer panel if I am the target
  if (iAmTarget) return null;
  if (!showViewerPanel || !iAmViewer || !mySession) return null;

  const target = mySession.target;

  // Mobile or fullscreen: take whole screen
  if (mob || isFullscreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9990, background: '#000', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(6,12,24,0.95)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {connected ? <><span style={bs.dot} /><span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>LIVE</span></> : <span style={{ color: '#64748b', fontSize: 12 }}>Connecting…</span>}
            <span style={{ fontSize: 13, color: '#f0f4ff', fontWeight: 600 }}>{target.name || target.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isFullscreen && !mob && <button style={bs.icon} onClick={() => setIsFullscreen(false)}>⊡ Exit</button>}
            <button style={bs.end} onClick={handleEnd}>✕ End</button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {connected && stream
            ? <><video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onPause={() => setIsPaused(true)} onPlay={() => setIsPaused(false)}
                onCanPlay={e => (e.target as HTMLVideoElement).play().catch(() => {})} />
              {isPaused && <PlayOverlay onClick={() => { videoRef.current?.play(); setIsPaused(false); }} />}</>
            : <ConnectState waiting={waiting} name={target.name || target.email} />}
        </div>
      </div>
    );
  }

  // Desktop: draggable floating panel
  return (
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: 680, height: 440, background: '#060c18', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.7)', zIndex: 9990, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none', resize: 'both', minWidth: 320, minHeight: 240 }}
      onMouseDown={onMouseDown} onTouchStart={onTouchStart}
    >
      <div data-drag="1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(148,163,184,0.08)', cursor: 'grab', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connected
            ? <><span style={bs.dot} /><span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span></>
            : waiting ? <span style={{ color: '#f59e0b', fontSize: 11 }}>⏳ Waiting for share…</span>
            : <span style={{ color: '#64748b', fontSize: 11 }}>○ Connecting…</span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>{target.name || target.email}'s Screen</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={bs.icon} onClick={() => setShowViewerPanel(false)}>−</button>
          <button style={bs.icon} onClick={() => setIsFullscreen(true)}>⛶</button>
          <button style={bs.end} onClick={handleEnd}>✕ End</button>
        </div>
      </div>
      <div style={{ flex: 1, background: '#000', position: 'relative', overflow: 'hidden' }}>
        {connected && stream
          ? <><video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              onPause={() => setIsPaused(true)} onPlay={() => setIsPaused(false)}
              onCanPlay={e => (e.target as HTMLVideoElement).play().catch(() => {})}
              onLoadedMetadata={e => (e.target as HTMLVideoElement).play().catch(() => {})} />
            {isPaused && <PlayOverlay onClick={() => { videoRef.current?.play(); setIsPaused(false); }} />}</>
          : <ConnectState waiting={waiting} name={target.name || target.email} />}
      </div>
      {connected && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', borderTop: '1px solid rgba(148,163,184,0.06)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
          <span style={{ color: '#334155', fontSize: 11 }}>🔒 Encrypted · Drag header to move · Corner to resize</span>
          <button style={bs.icon} onClick={() => videoRef.current?.requestFullscreen?.()}>↗ Expand</button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PlayOverlay({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', cursor: 'pointer', gap: 10 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>▶</div>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Tap to play</p>
    </div>
  );
}

function ConnectState({ waiting, name }: { waiting: boolean; name: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 24 }}>
      <div style={bs.spin} />
      <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
        {waiting ? `Waiting for ${name} to choose what to share…` : 'Establishing secure connection…'}
      </p>
      {waiting && <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', margin: 0 }}>They will see a picker to choose screen or camera</p>}
    </div>
  );
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
export function ScreenShareWebRTCOrchestrator() {
  return (
    <>
      <ScreenShareIncomingModalWebRTC />
      <TargetScreenShareWebRTC />
      <ViewerScreenShareWebRTC />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const bs: Record<string, React.CSSProperties> = {
  dot:  { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'ssRecordPulse 1.5s ease-in-out infinite', flexShrink: 0 },
  stop: { padding: '5px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 32 },
  icon: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '4px 10px', minHeight: 32 },
  end:  { padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 32 },
  spin: { width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(34,197,94,0.15)', borderTop: '3px solid #22c55e', animation: 'ssSpin 0.8s linear infinite', flexShrink: 0 },
};