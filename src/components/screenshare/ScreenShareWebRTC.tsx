'use client';
// src/components/screenshare/ScreenShareWebRTC.tsx

import React, {
  useEffect, useRef, useCallback, useState,
} from 'react';
import { useScreenShare } from '@/components/screenshare/ScreenShareProvider';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // TURN fallback for home/remote users (open relay - works for testing)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const SIGNAL_POLL_MS = 500; // Faster polling

async function sendSignal(sessionId: string, toUserId: string, type: string, payload: unknown) {
  try {
    await fetch('/api/screenshare/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, toUserId, type, payload }),
    });
  } catch (e) { /* ignore */ }
}

async function pollSignals(sessionId: string) {
  try {
    const res = await fetch(`/api/screenshare/signal/poll?sessionId=${sessionId}`);
    const data = await res.json();
    return data.signals as { id: string; type: string; payload: unknown; fromUserId: string }[];
  } catch {
    return [];
  }
}

function isScreenShareSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

// ── TARGET HOOK ───────────────────────────────────────────────────────────────
function useWebRTCTarget(
  sessionId: string | null,
  viewerUserId: string | null,
  active: boolean
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stop = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current = null;
    setSharing(false);
    setStarting(false);
  }, []);

  const start = useCallback(async () => {
    if (!sessionId || !viewerUserId || starting) return;
    setError(null);
    setStarting(true);

    // Check HTTPS/localhost
    if (!isScreenShareSupported()) {
      setError('Screen sharing requires HTTPS. Use https:// or localhost.');
      setStarting(false);
      return;
    }

    try {
      // Request screen capture with better options
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setSharing(true);
      setStarting(false);

      // Handle user closing the share dialog
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stop();
        sendSignal(sessionId, viewerUserId, 'end', {});
      });

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(sessionId, viewerUserId, 'ice-candidate', e.candidate.toJSON());
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          // Try restarting ICE
          pc.restartIce();
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      await sendSignal(sessionId, viewerUserId, 'offer', { type: offer.type, sdp: offer.sdp });

      pollRef.current = setInterval(async () => {
        if (!pcRef.current) return;
        try {
          const signals = await pollSignals(sessionId);
          for (const sig of signals) {
            if (sig.type === 'answer' && pcRef.current.signalingState === 'have-local-offer') {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit)
              );
            }
            if (sig.type === 'ice-candidate') {
              await pcRef.current.addIceCandidate(
                new RTCIceCandidate(sig.payload as RTCIceCandidateInit)
              ).catch(() => {});
            }
            if (sig.type === 'end') stop();
          }
        } catch { /* ignore */ }
      }, SIGNAL_POLL_MS);

    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setError('Screen sharing was cancelled or denied.');
      } else if (err.name === 'NotSupportedError') {
        setError('Your browser does not support screen sharing. Try Chrome or Edge.');
      } else {
        setError(err.message || 'Failed to start screen sharing.');
      }
      setStarting(false);
      stop();
    }
  }, [sessionId, viewerUserId, starting, stop]);

  useEffect(() => {
    if (active && sessionId && viewerUserId && !sharing && !error && !starting) {
      start();
    }
    if (!active) stop();
  }, [active, sessionId, viewerUserId, sharing, error, starting, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { sharing, error, stop, starting };
}

// ── VIEWER HOOK ───────────────────────────────────────────────────────────────
function useWebRTCViewer(
  sessionId: string | null,
  targetUserId: string | null,
  active: boolean,
  onStream: (stream: MediaStream | null) => void,
  onConnected: (connected: boolean) => void
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [waiting, setWaiting] = useState(false);

  const stop = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    setWaiting(false);
    onStream(null);
    onConnected(false);
  }, [onStream, onConnected]);

  const startPolling = useCallback(() => {
    if (!sessionId || !targetUserId) return;
    setWaiting(true);

    pollRef.current = setInterval(async () => {
      try {
        const signals = await pollSignals(sessionId!);
        for (const sig of signals) {
          if (sig.type === 'offer' && !pcRef.current) {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;

            pc.ontrack = (e) => {
              if (e.streams && e.streams.length > 0) {
                const stream = e.streams[0];
                // Check if stream has video tracks
                if (stream.getVideoTracks().length > 0) {
                  onStream(stream);
                  onConnected(true);
                  setWaiting(false);
                }
              } else if (e.track) {
                // Fallback: create stream from track
                const stream = new MediaStream([e.track]);
                onStream(stream);
                onConnected(true);
                setWaiting(false);
              }
            };

            pc.oniceconnectionstatechange = () => {
              if (pc.iceConnectionState === 'connected') {
                onConnected(true);
                setWaiting(false);
              }
              if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
                onConnected(false);
              }
            };

            pc.onicecandidate = (e) => {
              if (e.candidate && sessionId && targetUserId) {
                sendSignal(sessionId, targetUserId, 'ice-candidate', e.candidate.toJSON());
              }
            };

            await pc.setRemoteDescription(
              new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit)
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(sessionId!, targetUserId!, 'answer', { type: answer.type, sdp: answer.sdp });
          }

          if (sig.type === 'ice-candidate' && pcRef.current) {
            try {
              await pcRef.current.addIceCandidate(
                new RTCIceCandidate(sig.payload as RTCIceCandidateInit)
              );
            } catch { /* ignore duplicate candidates */ }
          }

          if (sig.type === 'end') stop();
        }
      } catch { /* ignore */ }
    }, SIGNAL_POLL_MS);
  }, [sessionId, targetUserId, onStream, onConnected, stop]);

  useEffect(() => {
    if (active && sessionId && targetUserId) startPolling();
    if (!active) stop();
  }, [active, sessionId, targetUserId, startPolling, stop]);

  useEffect(() => () => stop(), [stop]);

  return { waiting };
}

// ─── TARGET COMPONENT ──────────────────────────────────────────────────────────
function TargetScreenShare() {
  const { mySession, iAmTarget, isActive, endSession } = useScreenShare();
  const viewerUserId = mySession?.requesterId ?? null;
  const sessionId = mySession?.id ?? null;
  const { sharing, error, stop, starting } = useWebRTCTarget(sessionId, viewerUserId, iAmTarget && isActive);

  const handleStop = async () => {
    stop();
    if (sessionId && viewerUserId) await sendSignal(sessionId, viewerUserId, 'end', {});
    await endSession();
  };

  if (!iAmTarget || !isActive) return null;

  return (
    <div style={styles.targetBadge}>
      <span style={styles.recordDot} />
      {error ? (
        <>
          <span style={{ color: '#fbbf24', maxWidth: 400, fontSize: 12 }}>{error}</span>
          <button style={styles.stopBtn} onClick={handleStop}>Cancel</button>
        </>
      ) : sharing ? (
        <>
          <span>Your screen is being shared live</span>
          <button style={styles.stopBtn} onClick={handleStop}>Stop Sharing</button>
        </>
      ) : starting ? (
        <>
          <span>⏳ Opening screen picker...</span>
          <button style={styles.stopBtn} onClick={handleStop}>Cancel</button>
        </>
      ) : (
        <>
          <span>Ready to share screen...</span>
          <button style={styles.stopBtn} onClick={handleStop}>Cancel</button>
        </>
      )}
    </div>
  );
}

// ─── VIEWER COMPONENT ──────────────────────────────────────────────────────────
function ViewerScreenShare() {
  const { mySession, iAmViewer, isActive, endSession, showViewerPanel } = useScreenShare();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sessionId = mySession?.id ?? null;
  const targetUserId = mySession?.targetId ?? null;
  const { waiting } = useWebRTCViewer(sessionId, targetUserId, iAmViewer && isActive, setStream, setConnected);

  // Handle stream attachment
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    // Ensure muted is set programmatically
    video.muted = true;
    video.srcObject = null;
    video.srcObject = stream;

    const tryPlay = () => {
      video.play().catch((err) => {
        if (err.name === 'NotAllowedError') {
          setIsPaused(true);
        }
      });
    };

    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.onloadeddata = tryPlay;
    }

    return () => {
      video.onloadeddata = null;
    };
  }, [stream]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.min(window.innerWidth - 360, Math.max(0, e.clientX - dragOffset.x));
    const newY = Math.min(window.innerHeight - 320, Math.max(0, e.clientY - dragOffset.y));
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = Math.min(window.innerWidth - 360, Math.max(0, touch.clientX - dragOffset.x));
    const newY = Math.min(window.innerHeight - 320, Math.max(0, touch.clientY - dragOffset.y));
    setPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  if (!showViewerPanel || !iAmViewer || !mySession) return null;

  const target = mySession.target;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.viewerPanel,
        ...(isFullscreen ? styles.viewerFullscreen : {
          right: 'auto',
          bottom: 'auto',
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'grab',
        }),
        width: isMobile ? 'calc(100vw - 40px)' : 640,
        height: isMobile ? 300 : 420,
      }}
    >
      {/* Drag handle */}
      <div
        style={styles.dragHandle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <span style={{ color: '#475569', fontSize: 12 }}>⋯</span>
      </div>

      {/* Header */}
      <div style={styles.viewerHeader}>
        <div style={styles.viewerHeaderLeft}>
          <span style={styles.liveIndicator}>
            {connected
              ? <><span style={styles.recordDot} /> LIVE</>
              : waiting ? '⏳ Waiting for screen...'
              : '○ Connecting...'}
          </span>
          <span style={styles.viewerTitle}>
            {target.name || target.email}'s Screen
          </span>
        </div>
        <div style={styles.viewerHeaderRight}>
          {!isMobile && (
            <button style={styles.iconBtn} onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? '⊡ Exit' : '⛶ Fullscreen'}
            </button>
          )}
          <button style={styles.endBtn} onClick={endSession}>✕ End</button>
        </div>
      </div>

      {/* Video */}
      <div style={styles.videoWrap}>
        {connected && stream ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              style={styles.video}
              onPause={() => setIsPaused(true)}
              onPlay={() => setIsPaused(false)}
            />
            {isPaused && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.7)',
                  cursor: 'pointer',
                  gap: 12,
                }}
                onClick={() => {
                  videoRef.current?.play().catch(() => {});
                  setIsPaused(false);
                }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(34,197,94,0.2)',
                  border: '2px solid #22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28,
                }}>▶</div>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                  Click to resume video
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.connectingWrap}>
            <div style={styles.spinner} />
            <p style={styles.connectingText}>
              {waiting
                ? `Waiting for ${target.name || target.email} to select what to share…`
                : 'Establishing secure connection…'}
            </p>
            <p style={styles.connectingHint}>
              They will see a browser dialog to choose a window or tab.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {connected && (
        <div style={styles.viewerFooter}>
          <span style={{ color: '#4ade80', fontSize: 11 }}>🔒 Encrypted · Peer-to-peer</span>
        </div>
      )}
    </div>
  );
}

// ─── EXPORT ────────────────────────────────────────────────────────────────────
export function ScreenShareWebRTCOrchestrator() {
  return (
    <>
      <TargetScreenShare />
      <ViewerScreenShare />
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  targetBadge: {
    position: 'fixed',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    borderRadius: 100,
    background: 'rgba(10,15,30,0.95)',
    border: '1px solid rgba(239,68,68,0.5)',
    boxShadow: '0 4px 24px rgba(239,68,68,0.2)',
    fontSize: 13,
    color: '#f0f4ff',
    backdropFilter: 'blur(12px)',
    whiteSpace: 'nowrap',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  recordDot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 8px #ef4444',
    animation: 'ssRecordPulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  },
  stopBtn: {
    padding: '4px 14px',
    borderRadius: 6,
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginLeft: 6,
  },
  viewerPanel: {
    position: 'fixed',
    background: '#060c18',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    zIndex: 9990,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'box-shadow 0.3s ease',
  },
  viewerFullscreen: {
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    borderRadius: 0,
  },
  dragHandle: {
    height: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    background: 'rgba(255,255,255,0.02)',
    borderBottom: '1px solid rgba(148,163,184,0.05)',
    flexShrink: 0,
    userSelect: 'none',
    touchAction: 'none',
  },
  viewerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(148,163,184,0.08)',
    flexShrink: 0,
  },
  viewerHeaderLeft: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' },
  viewerHeaderRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: '#4ade80',
    letterSpacing: '0.08em',
    flexShrink: 0,
  },
  viewerTitle: { fontSize: 13, fontWeight: 600, color: '#f0f4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  iconBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
    padding: '4px 10px',
  },
  endBtn: {
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)',
    color: '#f87171',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  videoWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    overflow: 'hidden',
    minHeight: 150,
  },
  video: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' },
  connectingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid rgba(34,197,94,0.15)',
    borderTop: '3px solid #22c55e',
    animation: 'ssSpin 0.8s linear infinite',
  },
  connectingText: { fontSize: 14, color: '#94a3b8', margin: 0 },
  connectingHint: { fontSize: 12, color: '#475569', margin: 0, maxWidth: 280 },
  viewerFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 16px',
    flexShrink: 0,
    borderTop: '1px solid rgba(148,163,184,0.08)',
    background: 'rgba(255,255,255,0.02)',
  },
};