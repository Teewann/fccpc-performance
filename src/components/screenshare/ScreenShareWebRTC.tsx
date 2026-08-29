'use client';
// src/components/screenshare/ScreenShareWebRTC.tsx
// Fixes: Chrome gesture chain, mobile detection, mirror effect, fast end

import React, {
  useEffect, useRef, useCallback, useState,
} from 'react';
import { useScreenShare } from '@/components/screenshare/ScreenShareProvider';

// ── Config ────────────────────────────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Uncomment for remote/home users (free TURN):
  // { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
];

const SIGNAL_POLL_MS = 400; // Fast signaling

// ── Device detection ──────────────────────────────────────────────────────────
function detectDevice() {
  if (typeof window === 'undefined') return { mobile: false, supported: true };
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(ua);
  const supported = !mobile && !!navigator.mediaDevices?.getDisplayMedia;
  return { mobile, supported };
}

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
  const off  = useRef({ x: 0, y: 0 });

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
    window.addEventListener('touchmove', tm); window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', up); };
  }, []);

  return { pos, onMouseDown, onTouchStart };
}

// ── TARGET HOOK ───────────────────────────────────────────────────────────────
function useWebRTCTarget(sessionId: string | null, viewerUserId: string | null, active: boolean) {
  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef   = useRef<NodeJS.Timeout | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const stop = useCallback((sendEnd = false) => {
    if (pollRef.current)  clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null; streamRef.current = null;
    setSharing(false);
    if (sendEnd && sessionId && viewerUserId) sendSignal(sessionId, viewerUserId, 'end', {});
  }, [sessionId, viewerUserId]);

  // KEY FIX: This is called DIRECTLY from a button onClick — no awaits before
  // getDisplayMedia — preserves Chrome's user gesture requirement
  const startWithStream = useCallback(async (stream: MediaStream) => {
    if (!sessionId || !viewerUserId) { stream.getTracks().forEach(t => t.stop()); return; }
    streamRef.current = stream;
    setSharing(true);
    setError(null);
    stream.getVideoTracks()[0].onended = () => stop(true);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal(sessionId, viewerUserId, 'ice-candidate', e.candidate.toJSON()); };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(sessionId, viewerUserId, 'offer', { type: offer.type, sdp: offer.sdp });

    pollRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      const signals = await pollSignals(sessionId);
      for (const sig of signals) {
        if (sig.type === 'answer' && pcRef.current?.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.payload as any));
        }
        if (sig.type === 'ice-candidate' && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.payload as any)).catch(() => {});
        }
        if (sig.type === 'end') stop(false);
      }
    }, SIGNAL_POLL_MS);
  }, [sessionId, viewerUserId, stop]);

  useEffect(() => { if (!active) stop(false); }, [active]);
  useEffect(() => () => stop(false), [stop]);

  return { sharing, error, setError, startWithStream, stop };
}

// ── VIEWER HOOK ───────────────────────────────────────────────────────────────
function useWebRTCViewer(sessionId: string | null, targetUserId: string | null, active: boolean, onStream: (s: MediaStream | null) => void) {
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
      const signals = await pollSignals(sessionId!);
      for (const sig of signals) {
        if (sig.type === 'offer' && !pcRef.current) {
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;

          pc.ontrack = (e) => {
            const stream = e.streams[0] || new MediaStream([e.track]);
            onStream(stream); setConnected(true); setWaiting(false);
          };
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') { setConnected(true); setWaiting(false); }
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setConnected(false);
          };
          pc.onicecandidate = (e) => {
            if (e.candidate) sendSignal(sessionId!, targetUserId!, 'ice-candidate', e.candidate.toJSON());
          };

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
    }, SIGNAL_POLL_MS);

    return () => stop(false);
  }, [active, sessionId, targetUserId]);

  useEffect(() => () => stop(false), [stop]);
  return { connected, waiting, stop };
}

// ── INCOMING MODAL — centered, draggable ──────────────────────────────────────
export function ScreenShareIncomingModalWebRTC() {
  const { incomingRequest, respondToRequest } = useScreenShare();
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(60);

  const cx = typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 300;
  const cy = typeof window !== 'undefined' ? window.innerHeight / 2 - 200 : 200;
  const { pos, onMouseDown, onTouchStart } = useDraggable(cx, cy);
  const mob = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (!incomingRequest) return;
    setCountdown(60);
    const t = setInterval(() => setCountdown((c) => c <= 1 ? (clearInterval(t), 0) : c - 1), 1000);
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div
        style={{
          position: 'fixed',
          left: mob ? 16 : pos.x, top: mob ? '50%' : pos.y,
          transform: mob ? 'translateY(-50%)' : 'none',
          width: mob ? 'calc(100vw - 32px)' : 400,
          background: '#0d1526', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          zIndex: 10001, overflow: 'hidden', userSelect: 'none',
        }}
        onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      >
        {/* Drag header */}
        <div data-drag="1" style={{ padding: '16px 20px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.1)', cursor: 'grab', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👁️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>Screen View Request</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Auto-declines in <strong style={{ color: countdown > 20 ? '#4ade80' : countdown > 10 ? '#f59e0b' : '#ef4444' }}>{countdown}s</strong></div>
          </div>
          {!mob && <span style={{ fontSize: 10, color: '#334155', letterSpacing: 2 }}>⋮⋮</span>}
        </div>

        <div style={{ padding: 20 }}>
          {/* Who's asking */}
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
            Wants to view your screen live. You will choose exactly what to share — a tab, window, or full screen.
          </p>

          <div style={{ padding: '9px 12px', borderRadius: 8, marginBottom: 14, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', fontSize: 12, color: '#a16207' }}>
            ⚠ <strong>You stay in control.</strong> Stop sharing anytime with the red badge at the top.
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(148,163,184,0.1)', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: countdown > 20 ? '#22c55e' : countdown > 10 ? '#f59e0b' : '#ef4444', width: `${(countdown / 60) * 100}%`, transition: 'width 1s linear, background 0.3s' }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => respond('REJECT')} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Decline
            </button>
            <button onClick={() => respond('ACCEPT')} disabled={loading} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
              {loading ? 'Accepting…' : '✓ Accept & Share'}
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

  const { sharing, error, setError, startWithStream, stop } = useWebRTCTarget(sessionId, viewerUserId, iAmTarget && isActive);
  const [showPicker, setShowPicker] = useState(false);
  const { mobile, supported } = detectDevice();

  // Show picker when session becomes active
  useEffect(() => {
    if (iAmTarget && isActive && !sharing && !error) {
      if (!supported) {
        setError(mobile
          ? 'Screen sharing is not supported on mobile browsers. Please ask an admin to use a desktop computer.'
          : 'Screen sharing requires HTTPS or localhost. Please access via the secure URL.'
        );
        return;
      }
      setShowPicker(true);
    }
    if (!isActive) setShowPicker(false);
  }, [iAmTarget, isActive]);

  const handleStop = async () => { stop(true); await endSession(); };

  // ── CRITICAL FIX: getDisplayMedia called DIRECTLY in onClick ─────────────
  // No intermediate callbacks — Chrome requires the call to be synchronously
  // inside the user gesture handler. Any await before it breaks Chrome.
  const handlePickShare = async (displaySurface: 'browser' | 'window' | 'monitor') => {
    setShowPicker(false);
    try {
      // THIS LINE must be the first thing called after user click — no awaits before it
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 }, displaySurface } as any,
        audio: false,
      });
      await startWithStream(stream);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Sharing cancelled. Click "Share Screen" again to retry.');
      } else {
        setError('Could not start sharing: ' + (err.message || 'Unknown error'));
      }
    }
  };

  if (!iAmTarget || !isActive) return null;

  return (
    <>
      {/* Screen picker modal — modern, centered */}
      {showPicker && supported && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 420, background: '#0d1526', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖥️</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>What do you want to share?</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}><strong style={{ color: '#4ade80' }}>{viewerName}</strong> will see this live</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 24px 24px' }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                Choose what to share. Your browser will confirm your selection.
              </p>

              {[
                { surface: 'monitor' as const, icon: '🖥️', label: 'Entire Screen',       desc: 'Share everything visible on your display', warn: true  },
                { surface: 'window'  as const, icon: '🪟', label: 'Application Window',  desc: 'Share one specific app or window',          warn: false },
                { surface: 'browser' as const, icon: '📄', label: 'Browser Tab',          desc: 'Share just one browser tab (most private)',  warn: false },
              ].map((opt) => (
                <button
                  key={opt.surface}
                  onClick={() => handlePickShare(opt.surface)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', color: 'inherit' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.cssText += ';background:rgba(34,197,94,0.08);border-color:rgba(34,197,94,0.25)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.cssText += ';background:rgba(255,255,255,0.03);border-color:rgba(148,163,184,0.1)'; }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    {opt.warn && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>⚠ Avoid sharing this app window to prevent mirror effect</div>}
                  </div>
                  <span style={{ color: '#4ade80', fontSize: 18, flexShrink: 0 }}>›</span>
                </button>
              ))}

              <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
                🔒 Encrypted peer-to-peer · Not recorded by the server
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button onClick={handleStop} style={{ padding: '8px 28px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.15)', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile unsupported message */}
      {showPicker && !supported && mobile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 340, background: '#0d1526', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 20, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
            <h3 style={{ color: '#f0f4ff', fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Not Available on Mobile</h3>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Screen sharing is a browser limitation on mobile devices. Please open this app on a <strong style={{ color: '#f0f4ff' }}>desktop or laptop computer</strong> to share your screen.
            </p>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>
              The person requesting your screen can still see your activity feed and you can view their screen on mobile.
            </p>
            <button onClick={handleStop} style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Status badge — top center */}
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 18px', borderRadius: 100,
        background: 'rgba(10,15,30,0.95)',
        border: `1px solid ${error ? 'rgba(234,179,8,0.4)' : sharing ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.3)'}`,
        boxShadow: `0 4px 20px ${sharing ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.3)'}`,
        fontSize: 13, color: '#f0f4ff', backdropFilter: 'blur(12px)',
        maxWidth: 'calc(100vw - 24px)', whiteSpace: 'nowrap',
      }}>
        {error ? (
          <><span>⚠️</span><span style={{ color: '#fbbf24', fontSize: 12 }}>{error}</span><button onClick={handleStop} style={bs.stop}>Dismiss</button></>
        ) : sharing ? (
          <><span style={bs.dot} /><span>Sharing live — <strong style={{ color: '#4ade80' }}>{viewerName}</strong> is watching</span><button onClick={handleStop} style={bs.stop}>Stop</button></>
        ) : showPicker ? (
          <><span>🖥️</span><span style={{ color: '#94a3b8' }}>Select what to share…</span></>
        ) : (
          <><div style={bs.spin} /><span style={{ color: '#94a3b8' }}>Preparing…</span><button onClick={handleStop} style={bs.stop}>Cancel</button></>
        )}
      </div>
    </>
  );
}

// ── VIEWER COMPONENT — draggable, resizable, no mirror ────────────────────────
export function ViewerScreenShareWebRTC() {
  const { mySession, iAmViewer, iAmTarget, isActive, endSession, showViewerPanel, setShowViewerPanel } = useScreenShare();
  const [stream,       setStream]       = useState<MediaStream | null>(null);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const mob   = typeof window !== 'undefined' && window.innerWidth < 768;
  const initX = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 700)  : 100;
  const initY = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 480) : 100;
  const { pos, onMouseDown, onTouchStart } = useDraggable(initX, initY);

  const sessionId    = mySession?.id ?? null;
  const targetUserId = mySession?.targetId ?? null;

  const { connected, waiting, stop } = useWebRTCViewer(
    sessionId, targetUserId, iAmViewer && isActive, setStream
  );

  // Attach stream to video robustly
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = null; v.srcObject = stream; v.muted = true;
    const play = () => v.play().catch(() => setTimeout(() => v.play().catch(() => {}), 200));
    if (v.readyState >= 2) play(); else v.onloadeddata = play;
    return () => { v.onloadeddata = null; };
  }, [stream]);

  const handleEnd = async () => { stop(true); await endSession(); };

  // MIRROR FIX: Don't render viewer if I am also the target (sharing)
  // This prevents the infinite mirror/droste effect
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
            <span style={{ fontSize: 13, color: '#f0f4ff', fontWeight: 600 }}>{target.name || target.email}'s Screen</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isFullscreen && !mob && <button style={bs.icon} onClick={() => setIsFullscreen(false)}>⊡ Exit</button>}
            <button style={bs.end} onClick={handleEnd}>✕ End</button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {connected && stream
            ? <><video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} onPause={() => setIsPaused(true)} onPlay={() => setIsPaused(false)} onCanPlay={(e) => (e.target as HTMLVideoElement).play().catch(() => {})} />
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
      {/* Drag header */}
      <div data-drag="1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(148,163,184,0.08)', cursor: 'grab', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {connected ? <><span style={bs.dot} /><span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span></>
            : waiting ? <span style={{ color: '#f59e0b', fontSize: 11 }}>⏳ Waiting for screen picker…</span>
            : <span style={{ color: '#64748b', fontSize: 11 }}>○ Connecting…</span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>{target.name || target.email}'s Screen</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={bs.icon} onClick={() => setShowViewerPanel(false)} title="Minimise">−</button>
          <button style={bs.icon} onClick={() => setIsFullscreen(true)} title="Fullscreen">⛶</button>
          <button style={bs.end} onClick={handleEnd}>✕ End</button>
        </div>
      </div>

      {/* Video */}
      <div style={{ flex: 1, background: '#000', position: 'relative', overflow: 'hidden' }}>
        {connected && stream
          ? <><video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
               onPause={() => setIsPaused(true)} onPlay={() => setIsPaused(false)}
               onCanPlay={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
               onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play().catch(() => {})} />
             {isPaused && <PlayOverlay onClick={() => { videoRef.current?.play(); setIsPaused(false); }} />}</>
          : <ConnectState waiting={waiting} name={target.name || target.email} />}
      </div>

      {/* Footer */}
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
      {waiting && <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', margin: 0 }}>They will see a screen-picker dialog on their device</p>}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ScreenShareWebRTCOrchestrator() {
  return (
    <>
      <ScreenShareIncomingModalWebRTC />
      <TargetScreenShareWebRTC />
      <ViewerScreenShareWebRTC />
    </>
  );
}

// ── Shared button styles ──────────────────────────────────────────────────────
const bs: Record<string, React.CSSProperties> = {
  dot:  { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'ssRecordPulse 1.5s ease-in-out infinite', flexShrink: 0 },
  stop: { padding: '4px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  icon: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '4px 10px' },
  end:  { padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  spin: { width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(34,197,94,0.15)', borderTop: '3px solid #22c55e', animation: 'ssSpin 0.8s linear infinite' },
};