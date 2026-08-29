'use client';
// src/components/screenshare/ScreenShareWebRTC.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Real screen sharing using WebRTC + polling-based signaling.
//
// HOW IT WORKS:
//   TARGET (person being watched):
//     1. Session accepted → getDisplayMedia() → browser shows screen picker
//     2. Creates RTCPeerConnection + offer → stores offer in DB via /api/screenshare/signal
//     3. Polls for answer from viewer → sets remote description
//     4. Exchanges ICE candidates via DB
//     5. Video stream flows peer-to-peer to viewer
//
//   VIEWER (person watching):
//     1. Polls for offer → creates RTCPeerConnection + answer
//     2. Stores answer in DB → polls for ICE candidates
//     3. Receives live video stream → displays in <video> tag
//
// EXPORT: <ScreenShareWebRTCOrchestrator /> — add this to your layout
//         replaces the old activity-feed viewer panel
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useEffect, useRef, useCallback, useState,
} from 'react';
import { useScreenShare } from '@/components/screenshare/ScreenShareProvider';

// ─── TURN/STUN config ────────────────────────────────────────────────────────
// Free STUN servers from Google — works on same network and most ISPs.
// For home/remote users on different ISPs you may need a TURN server.
// Free TURN: https://www.metered.ca/tools/openrelay/ (add credentials to .env)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Uncomment and fill in if you have a TURN server (needed for remote/home users):
  // {
  //   urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:openrelay.metered.ca:80',
  //   username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject',
  //   credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject',
  // },
];

// How often to poll for new signals (ms) — fast for low latency
const SIGNAL_POLL_MS = 1000;

// ─── Helper: send a signal to the other peer ─────────────────────────────────
async function sendSignal(
  sessionId: string,
  toUserId: string,
  type: string,
  payload: unknown
) {
  await fetch('/api/screenshare/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, toUserId, type, payload }),
  });
}

// ─── Helper: poll for signals addressed to me ─────────────────────────────────
async function pollSignals(sessionId: string) {
  const res = await fetch(`/api/screenshare/signal/poll?sessionId=${sessionId}`);
  const data = await res.json();
  return data.signals as { id: string; type: string; payload: unknown; fromUserId: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TARGET HOOK — runs on the person being watched
// ─────────────────────────────────────────────────────────────────────────────
function useWebRTCTarget(
  sessionId: string | null,
  viewerUserId: string | null,
  active: boolean
) {
  const pcRef       = useRef<RTCPeerConnection | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const pollRef     = useRef<NodeJS.Timeout | null>(null);
  const [sharing, setSharing]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current  = null;
    streamRef.current = null;
    setSharing(false);
  }, []);

  const start = useCallback(async () => {
    if (!sessionId || !viewerUserId) return;
    setError(null);

    try {
      // Step 1: Ask user to pick what to share
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
      streamRef.current = stream;
      setSharing(true);

      // If user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => stop();

      // Step 2: Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // Add stream tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Step 3: Send ICE candidates as they arrive
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(sessionId, viewerUserId, 'ice-candidate', e.candidate.toJSON());
        }
      };

      // Step 4: Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Step 5: Send offer to viewer via DB
      await sendSignal(sessionId, viewerUserId, 'offer', {
        type: offer.type,
        sdp:  offer.sdp,
      });

      // Step 6: Poll for answer + ICE candidates from viewer
      pollRef.current = setInterval(async () => {
        if (!pcRef.current) return;
        try {
          const signals = await pollSignals(sessionId);
          for (const sig of signals) {
            if (sig.type === 'answer' && pcRef.current.signalingState === 'have-local-offer') {
              const answer = sig.payload as RTCSessionDescriptionInit;
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            }
            if (sig.type === 'ice-candidate') {
              const candidate = new RTCIceCandidate(sig.payload as RTCIceCandidateInit);
              await pcRef.current.addIceCandidate(candidate).catch(() => {});
            }
            if (sig.type === 'end') {
              stop();
            }
          }
        } catch {
          // Polling failure — ignore, retry next interval
        }
      }, SIGNAL_POLL_MS);

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Screen sharing was denied. Please allow screen access when prompted.');
      } else {
        setError('Failed to start screen sharing: ' + (err.message || 'Unknown error'));
      }
      stop();
    }
  }, [sessionId, viewerUserId, stop]);

  // Auto-start when session becomes active
  useEffect(() => {
    if (active && sessionId && viewerUserId && !sharing) {
      start();
    }
    if (!active) {
      stop();
    }
  }, [active, sessionId, viewerUserId]);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { sharing, error, stop };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER HOOK — runs on the person watching
// ─────────────────────────────────────────────────────────────────────────────
function useWebRTCViewer(
  sessionId: string | null,
  targetUserId: string | null,
  active: boolean,
  onStream: (stream: MediaStream | null) => void
) {
  const pcRef    = useRef<RTCPeerConnection | null>(null);
  const pollRef  = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected] = useState(false);
  const [waiting,   setWaiting]   = useState(false);

  const stop = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    setConnected(false);
    setWaiting(false);
    onStream(null);
  }, [onStream]);

  const startPollingForOffer = useCallback(() => {
    if (!sessionId || !targetUserId) return;
    setWaiting(true);

    pollRef.current = setInterval(async () => {
      if (!sessionId) return;
      try {
        const signals = await pollSignals(sessionId);

        for (const sig of signals) {
          // Got an offer from target — create answer
          if (sig.type === 'offer' && !pcRef.current) {
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcRef.current = pc;

            // When we receive the remote stream — show it
            pc.ontrack = (e) => {
              if (e.streams[0]) {
                onStream(e.streams[0]);
                setConnected(true);
                setWaiting(false);
              }
            };

            // Send our ICE candidates to target
            pc.onicecandidate = (e) => {
              if (e.candidate && sessionId && targetUserId) {
                sendSignal(sessionId, targetUserId, 'ice-candidate', e.candidate.toJSON());
              }
            };

            pc.onconnectionstatechange = () => {
              if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                setConnected(false);
              }
            };

            // Set offer, create answer
            const offer = sig.payload as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer back to target
            await sendSignal(sessionId, targetUserId, 'answer', {
              type: answer.type,
              sdp:  answer.sdp,
            });
          }

          // ICE candidates from target
          if (sig.type === 'ice-candidate' && pcRef.current) {
            const candidate = new RTCIceCandidate(sig.payload as RTCIceCandidateInit);
            await pcRef.current.addIceCandidate(candidate).catch(() => {});
          }

          if (sig.type === 'end') {
            stop();
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, SIGNAL_POLL_MS);
  }, [sessionId, targetUserId, onStream, stop]);

  useEffect(() => {
    if (active && sessionId && targetUserId) {
      startPollingForOffer();
    }
    if (!active) {
      stop();
    }
  }, [active, sessionId, targetUserId]);

  useEffect(() => () => stop(), [stop]);

  return { connected, waiting };
}

// ─────────────────────────────────────────────────────────────────────────────
// TARGET COMPONENT — shown to the person being watched
// ─────────────────────────────────────────────────────────────────────────────
function TargetScreenShare() {
  const { mySession, iAmTarget, isActive, endSession } = useScreenShare();

  const viewerUserId = mySession?.requesterId ?? null;
  const sessionId    = mySession?.id ?? null;

  const { sharing, error, stop } = useWebRTCTarget(sessionId, viewerUserId, iAmTarget && isActive);

  const handleStop = async () => {
    stop();
    if (sessionId && viewerUserId) {
      await sendSignal(sessionId, viewerUserId, 'end', {});
    }
    await endSession();
  };

  if (!iAmTarget || !isActive) return null;

  return (
    <div style={styles.targetBadge}>
      <span style={styles.recordDot} />
      {sharing ? (
        <>
          <span>Your screen is being shared live</span>
          <button style={styles.stopBtn} onClick={handleStop}>Stop Sharing</button>
        </>
      ) : error ? (
        <>
          <span style={{ color: '#fbbf24' }}>{error}</span>
          <button style={styles.stopBtn} onClick={handleStop}>Cancel</button>
        </>
      ) : (
        <>
          <span>Starting screen share…</span>
          <button style={styles.stopBtn} onClick={handleStop}>Cancel</button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER COMPONENT — shown to the person watching
// ─────────────────────────────────────────────────────────────────────────────
function ViewerScreenShare() {
  const { mySession, iAmViewer, isActive, endSession, showViewerPanel } = useScreenShare();
  const [stream,    setStream]    = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const sessionId    = mySession?.id ?? null;
  const targetUserId = mySession?.targetId ?? null;

  const { connected, waiting } = useWebRTCViewer(
    sessionId,
    targetUserId,
    iAmViewer && isActive,
    setStream
  );

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!showViewerPanel || !iAmViewer || !mySession) return null;

  const target = mySession.target;

  return (
    <div style={{ ...styles.viewerPanel, ...(isFullscreen ? styles.viewerFullscreen : {}) }}>
      {/* Header */}
      <div style={styles.viewerHeader}>
        <div style={styles.viewerHeaderLeft}>
          <span style={styles.liveIndicator}>
            {connected ? <><span style={styles.recordDot} /> LIVE</> : waiting ? '⏳ Waiting…' : '○ Connecting…'}
          </span>
          <span style={styles.viewerTitle}>
            {target.name || target.email}'s Screen
          </span>
        </div>
        <div style={styles.viewerHeaderRight}>
          <button
            style={styles.iconBtn}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '⛶' : '⛶'}
          </button>
          <button style={styles.endBtn} onClick={endSession}>✕ End</button>
        </div>
      </div>

      {/* Video area */}
      <div style={styles.videoWrap}>
        {connected && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={styles.video}
          />
        ) : (
          <div style={styles.connectingWrap}>
            <div style={styles.spinner} />
            <p style={styles.connectingText}>
              {waiting
                ? `Waiting for ${target.name || target.email} to share their screen…`
                : 'Establishing connection…'}
            </p>
            <p style={styles.connectingHint}>
              The other user will see a browser prompt to select what to share.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {connected && (
        <div style={styles.viewerFooter}>
          <span style={{ color: '#4ade80', fontSize: 12 }}>🔒 Encrypted peer-to-peer connection</span>
          <button
            style={styles.iconBtn}
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.requestFullscreen?.();
              }
            }}
          >
            Expand video ↗
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR — import this and add to your layout INSTEAD of old panel
// ─────────────────────────────────────────────────────────────────────────────
export function ScreenShareWebRTCOrchestrator() {
  return (
    <>
      <TargetScreenShare />
      <ViewerScreenShare />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  targetBadge: {
    position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 20px', borderRadius: 100,
    background: 'rgba(10,15,30,0.95)',
    border: '1px solid rgba(239,68,68,0.5)',
    boxShadow: '0 4px 24px rgba(239,68,68,0.2)',
    fontSize: 13, color: '#f0f4ff',
    backdropFilter: 'blur(12px)',
    whiteSpace: 'nowrap',
  },
  recordDot: {
    display: 'inline-block', width: 8, height: 8,
    borderRadius: '50%', background: '#ef4444',
    boxShadow: '0 0 8px #ef4444',
    animation: 'ssRecordPulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  },
  stopBtn: {
    padding: '4px 14px', borderRadius: 6, border: 'none',
    background: '#ef4444', color: '#fff',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    marginLeft: 6,
  },

  viewerPanel: {
    position: 'fixed', bottom: 24, right: 24,
    width: 640, height: 420,
    background: '#060c18',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    zIndex: 9990,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  },
  viewerFullscreen: {
    bottom: 0, right: 0, left: 0, top: 0,
    width: '100vw', height: '100vh',
    borderRadius: 0,
  },
  viewerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(148,163,184,0.08)',
    flexShrink: 0,
  },
  viewerHeaderLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  viewerHeaderRight: { display: 'flex', alignItems: 'center', gap: 8 },
  liveIndicator: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 700, color: '#4ade80',
    letterSpacing: '0.08em',
  },
  viewerTitle: { fontSize: 13, fontWeight: 600, color: '#f0f4ff' },
  iconBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 6, color: '#94a3b8', fontSize: 12,
    cursor: 'pointer', padding: '4px 10px',
  },
  endBtn: {
    padding: '4px 12px', borderRadius: 6,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#f87171',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },

  videoWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#000', overflow: 'hidden',
  },
  video: {
    width: '100%', height: '100%',
    objectFit: 'contain',
    background: '#000',
  },

  connectingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    padding: 32,
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid rgba(34,197,94,0.15)',
    borderTop: '3px solid #22c55e',
    animation: 'ssSpin 0.8s linear infinite',
  },
  connectingText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', margin: 0 },
  connectingHint: { fontSize: 12, color: '#475569', textAlign: 'center', margin: 0 },

  viewerFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', flexShrink: 0,
    borderTop: '1px solid rgba(148,163,184,0.08)',
    background: 'rgba(255,255,255,0.02)',
  },
};