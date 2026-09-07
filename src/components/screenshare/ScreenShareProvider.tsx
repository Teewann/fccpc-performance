'use client';
// src/components/screenshare/ScreenShareProvider.tsx
//
// KEY BEHAVIOUR CHANGE:
// - Background polling ALWAYS runs (every 15s) for ALL logged-in users
// - This allows receivers to get incoming requests without clicking anything
// - Fast polling (2s) only when session is active or button was clicked
// - No more "click to start polling" requirement for receivers

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { useScreenShareBroadcast } from '@/hooks/useScreenShareBroadcast';

// Polling intervals
const IDLE_POLL_MS   = 15_000; // Background check every 15s - catches incoming requests cheaply
const ACTIVE_POLL_MS = 2_000;  // When session active — fast poll

export interface UserSummary {
  id: string; name: string | null; email: string; role: string; image?: string | null;
}

export interface LiveSession {
  id: string; requesterId: string; targetId: string; status: string;
  startedAt: string | null; createdAt: string;
  requester: UserSummary; target: UserSummary;
}

export interface LiveHeartbeat {
  currentUrl: string; pageTitle: string;
  scrollY: number; timestamp: string;
}

interface ScreenShareContextValue {
  mySession:            LiveSession | null;
  incomingRequest:      LiveSession | null;
  liveHeartbeat:        LiveHeartbeat | null;
  isStale:              boolean;
  secondsSinceLastBeat: number | null;
  iAmViewer:            boolean;
  iAmTarget:            boolean;
  isActive:             boolean;
  requestSession:       (targetUserId: string) => Promise<void>;
  respondToRequest:     (sessionId: string, action: 'ACCEPT' | 'REJECT') => Promise<void>;
  endSession:           () => Promise<void>;
  verifyPassword:       (password: string) => Promise<boolean>;
  showRequestModal:     boolean;
  setShowRequestModal:  (v: boolean) => void;
  showViewerPanel:      boolean;
  setShowViewerPanel:   (v: boolean) => void;
  activatePolling:      () => void;
}

const ScreenShareContext = createContext<ScreenShareContextValue | null>(null);

export function useScreenShare() {
  const ctx = useContext(ScreenShareContext);
  if (!ctx) throw new Error('useScreenShare must be used inside ScreenShareProvider');
  return ctx;
}

export function ScreenShareProvider({ children }: { children: ReactNode }) {
  const { data: authSession, status } = useSession();
  const myId = (authSession?.user as any)?.id as string | undefined;

  const [mySession,            setMySession]            = useState<LiveSession | null>(null);
  const [incomingRequest,      setIncomingRequest]      = useState<LiveSession | null>(null);
  const [liveHeartbeat,        setLiveHeartbeat]        = useState<LiveHeartbeat | null>(null);
  const [isStale,              setIsStale]              = useState(false);
  const [secondsSinceLastBeat, setSecondsSinceLastBeat] = useState<number | null>(null);
  const [showRequestModal,     setShowRequestModal]     = useState(false);
  const [showViewerPanel,      setShowViewerPanel]      = useState(false);
  const [pollingEnabled,       setPollingEnabled]       = useState(false);

  const pendingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef    = useRef<NodeJS.Timeout | null>(null);
  const mySessionRef       = useRef<LiveSession | null>(null);

  // Keep ref in sync so callbacks always have fresh session state
  useEffect(() => { mySessionRef.current = mySession; }, [mySession]);

  const iAmViewer = !!mySession && mySession.requesterId === myId;
  const iAmTarget = !!mySession && mySession.targetId    === myId;
  const isActive  = mySession?.status === 'ACTIVE';

  // Broadcast heartbeats only when I am the target of an active session
  useScreenShareBroadcast({ active: iAmTarget && isActive });

  // ── activatePolling — called when Share Screen button is clicked ──
  const activatePolling = useCallback(() => {
    setPollingEnabled(true);
  }, []);

  // ── Poll for incoming requests (target side) ──────────────────
  const pollPending = useCallback(async () => {
    if (!myId) return;
    try {
      const res  = await fetch('/api/screenshare/pending');
      const data = await res.json();
      if (data.incoming) {
        if (data.incoming.status === 'PENDING') {
          setIncomingRequest(data.incoming as LiveSession);
          setMySession(data.incoming as LiveSession);
          // Auto-activate polling when we receive an incoming request
          setPollingEnabled(true);
        } else if (data.incoming.status === 'ACTIVE') {
          setMySession(data.incoming as LiveSession);
          setIncomingRequest(null);
        } else {
          setIncomingRequest(null);
          const cur = mySessionRef.current;
          if (cur?.targetId === myId) setMySession(null);
        }
      } else {
        setIncomingRequest(null);
        const cur = mySessionRef.current;
        if (cur?.targetId === myId) setMySession(null);
      }
    } catch {}
  }, [myId]);

  // ── Poll for viewer heartbeat (requester/viewer side) ─────────
  const pollViewer = useCallback(async () => {
    if (!myId || !iAmViewer) return;
    try {
      const res  = await fetch('/api/screenshare/poll');
      const data = await res.json();
      if (!data.session) {
        setMySession(null); setLiveHeartbeat(null); setShowViewerPanel(false); return;
      }
      setMySession(data.session as LiveSession);
      if (data.session.status !== 'ACTIVE') { setLiveHeartbeat(null); return; }
      // Only show viewer panel if there's a heartbeat
      if (data.heartbeat) {
        setLiveHeartbeat(data.heartbeat as LiveHeartbeat);
        setShowViewerPanel(true);
      }
      setIsStale(data.stale ?? false);
      setSecondsSinceLastBeat(data.secondsSinceLastBeat ?? null);
    } catch {}
  }, [myId, iAmViewer]);

  // ── Polling logic — ALWAYS RUNS (two-tier approach) ───────────────
  useEffect(() => {
    if (status !== 'authenticated' || !myId) return;

    // Clear any existing interval
    if (pendingIntervalRef.current) clearInterval(pendingIntervalRef.current);

    const hasActiveSession = !!mySession;

    // ✅ ALWAYS poll — just at different speeds
    // - IDLE: 15s background check (so receivers can get incoming requests)
    // - ACTIVE: 2s fast poll (when session exists or button clicked)
    const interval = hasActiveSession || pollingEnabled ? ACTIVE_POLL_MS : IDLE_POLL_MS;

    // Poll immediately then set interval
    pollPending();
    pendingIntervalRef.current = setInterval(pollPending, interval);

    return () => {
      if (pendingIntervalRef.current) clearInterval(pendingIntervalRef.current);
    };
  }, [status, myId, pollingEnabled, mySession, pollPending]);

  // ── Viewer poll — only when I am the viewer ───────────────────
  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (!iAmViewer) return;

    pollViewer();
    pollIntervalRef.current = setInterval(pollViewer, ACTIVE_POLL_MS);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [iAmViewer, pollViewer]);

  // ── Reset to idle polling when session ends ──────────────────
  useEffect(() => {
    if (!mySession && !incomingRequest && pollingEnabled) {
      const t = setTimeout(() => setPollingEnabled(false), 3_000);
      return () => clearTimeout(t);
    }
  }, [mySession, incomingRequest, pollingEnabled]);

  // ── Actions ───────────────────────────────────────────────────
  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    const res = await fetch('/api/screenshare/verify-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return (await res.json()).verified === true;
  }, []);

  const requestSession = useCallback(async (targetUserId: string) => {
    const res = await fetch('/api/screenshare/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create session');
    setMySession(data.session as LiveSession);
    setShowRequestModal(false);
  }, []);

  const respondToRequest = useCallback(async (sessionId: string, action: 'ACCEPT' | 'REJECT') => {
    const res = await fetch('/api/screenshare/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to respond');
    if (action === 'REJECT') { setIncomingRequest(null); setMySession(null); }
    else { setMySession(data.session as LiveSession); setIncomingRequest(null); }
  }, []);

  const endSession = useCallback(async () => {
    if (!mySessionRef.current) return;
    await fetch('/api/screenshare/end', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: mySessionRef.current.id }),
    });
    setMySession(null); setIncomingRequest(null);
    setLiveHeartbeat(null); setShowViewerPanel(false);
  }, []);

  const value: ScreenShareContextValue = {
    mySession, incomingRequest, liveHeartbeat, isStale, secondsSinceLastBeat,
    iAmViewer, iAmTarget, isActive,
    requestSession, respondToRequest, endSession, verifyPassword,
    showRequestModal, setShowRequestModal,
    showViewerPanel,  setShowViewerPanel,
    activatePolling,
  };

  return (
    <ScreenShareContext.Provider value={value}>
      {children}
    </ScreenShareContext.Provider>
  );
}