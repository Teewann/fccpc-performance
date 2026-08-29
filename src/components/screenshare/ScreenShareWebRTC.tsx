'use client';
// src/components/screenshare/ScreenShareWebRTC.tsx
// Complete rewrite — draggable panels, mobile, fast polling, modern prompts

import React, {
  useEffect, useRef, useCallback, useState, useLayoutEffect,
} from 'react';
import { useScreenShare } from '@/components/screenshare/ScreenShareProvider';

// ── Config ────────────────────────────────────────────────────────────────────
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Uncomment for remote/home users:
  // { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
];
const SIGNAL_POLL_MS = 500; // Fast — 500ms polling

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

function isScreenShareSupported() {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
}

// ── Draggable hook ────────────────────────────────────────────────────────────
function useDraggable(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset   = useRef({ x: 0, y: 0 });
  const ref      = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header (first child)
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    dragging.current = true;
    offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    e.preventDefault();
  }, [pos]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    dragging.current = true;
    const touch = e.touches[0];
    offset.current = {
      x: touch.clientX - pos.x,
      y: touch.clientY - pos.y,
    };
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const nx = e.clientX - offset.current.x;
      const ny = e.clientY - offset.current.y;
      setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
    };
    const onTouch = (e: TouchEvent) => {
      if (!dragging.current) return;
      const touch = e.touches[0];
      const nx = touch.clientX - offset.current.x;
      const ny = touch.clientY - offset.current.y;
      setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouch);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  return { ref, pos, onMouseDown, onTouchStart };
}

// ── Screen picker modal (shown before getDisplayMedia fires) ──────────────────
function ScreenPickerPrompt({
  targetName,
  onStart,
  onCancel,
}: {
  targetName: string;
  onStart: (type: 'screen' | 'window' | 'tab') => void;
  onCancel: () => void;
}) {
  const { pos, onMouseDown, onTouchStart } = useDraggable({
    x: Math.max(0, window.innerWidth / 2 - 220),
    y: Math.max(0, window.innerHeight / 2 - 200),
  });

  const mobile = isMobile();

  return (
    <div style={overlayStyle}>
      <div
        style={{
          position: 'fixed',
          left: mobile ? 16 : pos.x,
          top:  mobile ? '50%' : pos.y,
          transform: mobile ? 'translateY(-50%)' : 'none',
          width: mobile ? 'calc(100vw - 32px)' : 440,
          background: '#0d1526',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          zIndex: 10001,
          userSelect: 'none',
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Drag handle header */}
        <div data-drag-handle="true" style={{
          padding: '18px 20px 14px',
          background: 'rgba(34,197,94,0.06)',
          borderBottom: '1px solid rgba(34,197,94,0.1)',
          cursor: 'grab', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>🖥️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>Share Your Screen</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {targetName} will see your screen live
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#334155', letterSpacing: 2 }}>⋮⋮</div>
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            Choose what you want to share. The viewer will see it in real-time.
          </p>

          {/* Options */}
          {[
            { type: 'screen' as const, icon: '🖥️', label: 'Entire Screen', desc: 'Share everything on your display' },
            { type: 'window' as const, icon: '🪟', label: 'Application Window', desc: 'Share a specific app window' },
            { type: 'tab'    as const, icon: '📄', label: 'Browser Tab', desc: 'Share just this browser tab' },
          ].map((opt) => (
            <button
              key={opt.type}
              onClick={() => onStart(opt.type)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', marginBottom: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
                color: 'inherit',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,197,94,0.25)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.12)';
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 18 }}>›</span>
            </button>
          ))}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 24px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid rgba(148,163,184,0.15)',
                background: 'transparent', color: '#64748b', fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>

          <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            🔒 Encrypted peer-to-peer · No video stored on server
          </p>
        </div>
      </div>
    </div>
  );
}

// ── TARGET HOOK ───────────────────────────────────────────────────────────────
function useWebRTCTarget(
  sessionId: string | null,
  viewerUserId: string | null,
  active: boolean
) {
  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef   = useRef<NodeJS.Timeout | null>(null);
  const [sharing,       setSharing]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showPicker,    setShowPicker]    = useState(false);
  const [pickerStarted, setPickerStarted] = useState(false);

  const stop = useCallback((sendEnd = false) => {
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current     = null;
    streamRef.current = null;
    setSharing(false);
    setShowPicker(false);
    setPickerStarted(false);
    if (sendEnd && sessionId && viewerUserId) {
      sendSignal(sessionId, viewerUserId, 'end', {});
    }
  }, [sessionId, viewerUserId]);

  // Called when target picks share type from our custom modal
  const startSharing = useCallback(async (type: 'screen' | 'window' | 'tab') => {
    if (!sessionId || !viewerUserId) return;
    setShowPicker(false);
    setPickerStarted(true);
    setError(null);

    try {
      // getDisplayMedia — browser's native picker opens here
      // We pass preferred displaySurface but browser may ignore it
      const constraints: DisplayMediaStreamOptions = {
        video: {
          frameRate: { ideal: 15, max: 30 },
          ...(type === 'tab'    ? { displaySurface: 'browser'    } : {}),
          ...(type === 'window' ? { displaySurface: 'window'     } : {}),
          ...(type === 'screen' ? { displaySurface: 'monitor'    } : {}),
        } as any,
        audio: false,
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      streamRef.current = stream;
      setSharing(true);
      stream.getVideoTracks()[0].onended = () => stop(true);

      // Build peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(sessionId, viewerUserId, 'ice-candidate', e.candidate.toJSON());
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(sessionId, viewerUserId, 'offer', { type: offer.type, sdp: offer.sdp });

      // Poll for answer
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

    } catch (err: any) {
      setPickerStarted(false);
      if (err.name === 'NotAllowedError') {
        setError('Sharing was cancelled or denied. Click "Share Screen" again to retry.');
      } else if (err.name === 'NotSupportedError' || !isScreenShareSupported()) {
        setError('Your browser does not support screen sharing. Please use Chrome or Edge on desktop.');
      } else {
        setError(`Could not start sharing: ${err.message || 'Unknown error'}`);
      }
    }
  }, [sessionId, viewerUserId, stop]);

  // When session becomes active, show our custom picker
  useEffect(() => {
    if (active && sessionId && viewerUserId && !sharing && !pickerStarted && !showPicker) {
      if (!isScreenShareSupported()) {
        setError('Screen sharing is not supported on this device/browser.');
        return;
      }
      setShowPicker(true);
    }
    if (!active) stop(false);
  }, [active, sessionId, viewerUserId]);

  useEffect(() => () => stop(false), [stop]);

  return { sharing, error, showPicker, startSharing, cancelPicker: () => { setShowPicker(false); stop(true); }, stop };
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
    pcRef.current?.close();
    pcRef.current = null;
    setConnected(false);
    setWaiting(false);
    onStream(null);
    if (sendEnd && sessionId && targetUserId) {
      sendSignal(sessionId, targetUserId, 'end', {});
    }
  }, [sessionId, targetUserId, onStream]);

  const startPolling = useCallback(() => {
    if (!sessionId || !targetUserId) return;
    setWaiting(true);

    pollRef.current = setInterval(async () => {
      const signals = await pollSignals(sessionId!);
      for (const sig of signals) {
        if (sig.type === 'offer' && !pcRef.current) {
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          pcRef.current = pc;

          pc.ontrack = (e) => {
            const stream = e.streams[0] || new MediaStream([e.track]);
            onStream(stream);
            setConnected(true);
            setWaiting(false);
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') { setConnected(true); setWaiting(false); }
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setConnected(false);
          };

          pc.onicecandidate = (e) => {
            if (e.candidate && sessionId && targetUserId) {
              sendSignal(sessionId, targetUserId, 'ice-candidate', e.candidate.toJSON());
            }
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
  }, [sessionId, targetUserId, onStream, stop]);

  useEffect(() => {
    if (active && sessionId && targetUserId) startPolling();
    if (!active) stop(false);
  }, [active, sessionId, targetUserId]);

  useEffect(() => () => stop(false), [stop]);

  return { connected, waiting, stop };
}

// ── INCOMING REQUEST MODAL — centered + draggable ─────────────────────────────
export function ScreenShareIncomingModalWebRTC() {
  const { incomingRequest, respondToRequest } = useScreenShare();
  const [loading,   setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(60);

  const initX = typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 300;
  const initY = typeof window !== 'undefined' ? window.innerHeight / 2 - 180 : 200;
  const { pos, onMouseDown, onTouchStart } = useDraggable({ x: initX, y: initY });

  useEffect(() => {
    if (!incomingRequest) return;
    setCountdown(60);
    const t = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [incomingRequest?.id]);

  const respond = async (action: 'ACCEPT' | 'REJECT') => {
    if (!incomingRequest) return;
    setLoading(true);
    try { await respondToRequest(incomingRequest.id, action); }
    finally { setLoading(false); }
  };

  if (!incomingRequest || incomingRequest.status !== 'PENDING') return null;

  const requester = incomingRequest.requester;
  const mobile    = isMobile();

  return (
    <div style={overlayStyle}>
      <div
        style={{
          position: 'fixed',
          left: mobile ? 16 : pos.x,
          top:  mobile ? '50%' : pos.y,
          transform: mobile ? 'translateY(-50%)' : 'none',
          width: mobile ? 'calc(100vw - 32px)' : 400,
          background: '#0d1526',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          zIndex: 10000,
          overflow: 'hidden',
          userSelect: 'none',
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Drag handle */}
        <div data-drag-handle="true" style={{
          padding: '18px 20px 14px',
          background: 'rgba(34,197,94,0.06)',
          borderBottom: '1px solid rgba(34,197,94,0.1)',
          cursor: mobile ? 'default' : 'grab',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>👁️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff' }}>Screen View Request</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Drag to move · Auto-declines in <strong style={{ color: '#f59e0b' }}>{countdown}s</strong>
            </div>
          </div>
          {!mobile && <div style={{ fontSize: 10, color: '#334155', letterSpacing: 2 }}>⋮⋮</div>}
        </div>

        <div style={{ padding: '20px' }}>
          {/* Requester info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(148,163,184,0.08)',
            marginBottom: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#4ade80', flexShrink: 0,
            }}>
              {(requester.name || requester.email)[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff' }}>
                {requester.name || requester.email}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{requester.role}</div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 14 }}>
            Wants to view your screen in real-time. If you accept, you will be asked to choose what to share.
          </p>

          <div style={{
            padding: '10px 12px', borderRadius: 8, marginBottom: 16,
            background: 'rgba(234,179,8,0.06)',
            border: '1px solid rgba(234,179,8,0.15)',
            fontSize: 12, color: '#a16207', lineHeight: 1.5,
          }}>
            ⚠ <strong>You control what is shared.</strong> You can stop at any time using the red badge at the top of your screen.
          </div>

          {/* Countdown bar */}
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(148,163,184,0.1)', marginBottom: 16, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: countdown > 20 ? '#22c55e' : countdown > 10 ? '#f59e0b' : '#ef4444',
              width: `${(countdown / 60) * 100}%`,
              transition: 'width 1s linear, background 0.3s',
            }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              style={{
                flex: 1, padding: '12px', borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.15)',
                background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
              onClick={() => respond('REJECT')}
              disabled={loading}
            >
              Decline
            </button>
            <button
              style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
              }}
              onClick={() => respond('ACCEPT')}
              disabled={loading}
            >
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

  const { sharing, error, showPicker, startSharing, cancelPicker, stop } = useWebRTCTarget(
    sessionId, viewerUserId, iAmTarget && isActive
  );

  const handleStop = async () => {
    stop(true);
    await endSession();
  };

  if (!iAmTarget || !isActive) return null;

  return (
    <>
      {/* Custom screen picker modal */}
      {showPicker && (
        <ScreenPickerPrompt
          targetName={viewerName}
          onStart={startSharing}
          onCancel={cancelPicker}
        />
      )}

      {/* Status badge */}
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', borderRadius: 100,
        background: 'rgba(10,15,30,0.95)',
        border: `1px solid ${error ? 'rgba(234,179,8,0.5)' : sharing ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.4)'}`,
        boxShadow: `0 4px 24px ${sharing ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.1)'}`,
        fontSize: 13, color: '#f0f4ff', backdropFilter: 'blur(12px)',
        maxWidth: 'calc(100vw - 32px)', flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {error ? (
          <>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ color: '#fbbf24', fontSize: 12, maxWidth: 300, textAlign: 'center' }}>{error}</span>
            <button style={s.stopBtn} onClick={handleStop}>Dismiss</button>
          </>
        ) : sharing ? (
          <>
            <span style={s.recDot} />
            <span>Your screen is live — <strong style={{ color: '#4ade80' }}>{viewerName}</strong> is watching</span>
            <button style={s.stopBtn} onClick={handleStop}>Stop Sharing</button>
          </>
        ) : showPicker ? (
          <>
            <span style={{ fontSize: 14 }}>🖥️</span>
            <span style={{ color: '#94a3b8' }}>Choose what to share in the prompt…</span>
          </>
        ) : (
          <>
            <div style={s.spinner} />
            <span style={{ color: '#94a3b8' }}>Preparing screen share…</span>
            <button style={s.stopBtn} onClick={handleStop}>Cancel</button>
          </>
        )}
      </div>
    </>
  );
}

// ── VIEWER COMPONENT — draggable + resizable ──────────────────────────────────
export function ViewerScreenShareWebRTC() {
  const { mySession, iAmViewer, isActive, endSession, showViewerPanel, setShowViewerPanel } = useScreenShare();
  const [stream,       setStream]       = useState<MediaStream | null>(null);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelSize,    setPanelSize]    = useState({ w: 680, h: 440 });
  const videoRef = useRef<HTMLVideoElement>(null);

  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const initX  = typeof window !== 'undefined' ? Math.max(0, window.innerWidth  - 700) : 100;
  const initY  = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 480) : 100;
  const { pos, onMouseDown, onTouchStart } = useDraggable({ x: initX, y: initY });

  const sessionId    = mySession?.id ?? null;
  const targetUserId = mySession?.targetId ?? null;
  const { connected, waiting, stop } = useWebRTCViewer(
    sessionId, targetUserId, iAmViewer && isActive, setStream
  );

  // Robust video attachment
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = null;
    video.srcObject = stream;
    video.muted = true;
    const tryPlay = () => video.play().catch(() => setTimeout(() => video.play().catch(() => {}), 300));
    if (video.readyState >= 2) tryPlay();
    else video.onloadeddata = tryPlay;
    return () => { video.onloadeddata = null; };
  }, [stream]);

  const handleEnd = async () => {
    stop(true);
    await endSession();
  };

  if (!showViewerPanel || !iAmViewer || !mySession) return null;

  const target = mySession.target;

  if (mobile || isFullscreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: '#000', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(6,12,24,0.95)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {connected ? <><span style={s.recDot} /><span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>LIVE</span></> : <span style={{ color: '#64748b', fontSize: 12 }}>Connecting…</span>}
            <span style={{ fontSize: 13, color: '#f0f4ff', fontWeight: 600 }}>{target.name || target.email}'s Screen</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!mobile && <button style={s.iconBtn} onClick={() => setIsFullscreen(false)}>⊡ Exit</button>}
            <button style={s.endBtn} onClick={handleEnd}>✕ End</button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          {connected && stream ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onPause={() => setIsPaused(true)} onPlay={() => setIsPaused(false)}
                onCanPlay={(e) => (e.target as HTMLVideoElement).play().catch(() => {})} />
              {isPaused && <PlayOverlay onClick={() => { videoRef.current?.play(); setIsPaused(false); }} />}
            </>
          ) : (
            <ConnectingState waiting={waiting} name={target.name || target.email} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y,
        width: panelSize.w, height: panelSize.h,
        background: '#060c18',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        zIndex: 9990, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', userSelect: 'none',
        resize: 'both', // native resize handle
        minWidth: 320, minHeight: 240,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Drag handle header */}
      <div data-drag-handle="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(148,163,184,0.08)',
        cursor: 'grab',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {connected
              ? <><span style={s.recDot} /><span style={{ color: '#4ade80', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE</span></>
              : waiting ? <span style={{ color: '#f59e0b', fontSize: 11 }}>⏳ Waiting for screen picker…</span>
              : <span style={{ color: '#64748b', fontSize: 11 }}>○ Connecting…</span>}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f4ff' }}>
            {target.name || target.email}'s Screen
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={s.iconBtn} onClick={() => setShowViewerPanel(false)} title="Minimise">−</button>
          <button style={s.iconBtn} onClick={() => setIsFullscreen(true)} title="Fullscreen">⛶</button>
          <button style={s.endBtn} onClick={handleEnd}>✕ End</button>
        </div>
      </div>

      {/* Video area */}
      <div style={{ flex: 1, background: '#000', position: 'relative', overflow: 'hidden' }}>
        {connected && stream ? (
          <>
            <video
              ref={videoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              onPause={() => setIsPaused(true)}
              onPlay={() => setIsPaused(false)}
              onCanPlay={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
              onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
            />
            {isPaused && <PlayOverlay onClick={() => { videoRef.current?.play(); setIsPaused(false); }} />}
          </>
        ) : (
          <ConnectingState waiting={waiting} name={target.name || target.email} />
        )}
      </div>

      {/* Footer */}
      {connected && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 14px', flexShrink: 0,
          borderTop: '1px solid rgba(148,163,184,0.06)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ color: '#334155', fontSize: 11 }}>🔒 Encrypted · Drag header to move · Drag corner to resize</span>
          <button style={s.iconBtn} onClick={() => videoRef.current?.requestFullscreen?.()}>↗ Video only</button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PlayOverlay({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', cursor: 'pointer', gap: 10,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
      }}>▶</div>
      <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Tap to play</p>
    </div>
  );
}

function ConnectingState({ waiting, name }: { waiting: boolean; name: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 24 }}>
      <div style={s.spinner} />
      <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
        {waiting
          ? `Waiting for ${name} to choose what to share…`
          : 'Establishing secure connection…'}
      </p>
      {waiting && (
        <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', margin: 0 }}>
          They will see a screen-picker dialog on their device
        </p>
      )}
    </div>
  );
}

// ── ORCHESTRATOR ──────────────────────────────────────────────────────────────
export function ScreenShareWebRTCOrchestrator() {
  return (
    <>
      <ScreenShareIncomingModalWebRTC />
      <TargetScreenShareWebRTC />
      <ViewerScreenShareWebRTC />
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10000,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
};

const s: Record<string, React.CSSProperties> = {
  recDot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: '#ef4444', boxShadow: '0 0 8px #ef4444',
    animation: 'ssRecordPulse 1.5s ease-in-out infinite', flexShrink: 0,
  },
  stopBtn: {
    padding: '4px 14px', borderRadius: 6, border: 'none',
    background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  iconBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '4px 10px',
  },
  endBtn: {
    padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid rgba(34,197,94,0.15)', borderTop: '3px solid #22c55e',
    animation: 'ssSpin 0.8s linear infinite',
  },
};