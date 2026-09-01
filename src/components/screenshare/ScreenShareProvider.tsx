// components/screenshare/ScreenShareProvider.tsx
// ─────────────────────────────────────────────────────────────
// Wrap your root layout with this provider.
// It runs three background jobs:
//   1. Polls /api/screenshare/pending — "do I have an incoming request?"
//   2. Polls /api/screenshare/poll   — "what is the target doing?" (viewer)
//   3. Sends heartbeats              — "here's what I'm doing" (target)
// All UI state for the feature lives here.
// ─────────────────────────────────────────────────────────────

'use client';

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import { useScreenShareBroadcast } from '@/hooks/useScreenShareBroadcast';

// ─── Types ────────────────────────────────────────────────────

export interface UserSummary {
  id: string; name: string | null; email: string; role: string; image?: string | null;
}

export interface LiveSession {
  id: string;
  requesterId: string;
  targetId: string;
  status: string;
  startedAt: string | null;
  createdAt: string;
  requester: UserSummary;
  target: UserSummary;
}

export interface LiveHeartbeat {
  currentUrl: string;
  pageTitle: string;
  clickEvent: { x: number; y: number; selector: string; text: string; timestamp: number } | null;
  actionEvent: { type: string; detail: string; timestamp: number } | null;
  inputEvent: { field: string; maskedValue: string; timestamp: number } | null;
  scrollY: number;
  timestamp: string;
}

interface ScreenShareContextValue {
  // State
  mySession:       LiveSession | null;   // any session I'm part of
  incomingRequest: LiveSession | null;   // someone wants to view me (PENDING)
  liveHeartbeat:   LiveHeartbeat | null; // latest data from target (when I'm viewer)
  isStale:         boolean;              // connection timed out?
  secondsSinceLastBeat: number | null;

  // Role flags
  iAmViewer:   boolean; // I initiated the session (requester)
  iAmTarget:   boolean; // I am being watched (target)
  isActive:    boolean; // session status === 'ACTIVE'

  // Actions
  requestSession: (targetUserId: string) => Promise<void>;
  respondToRequest: (sessionId: string, action: 'ACCEPT' | 'REJECT') => Promise<void>;
  endSession: () => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;

  // UI open/close
  showRequestModal:  boolean;
  setShowRequestModal: (v: boolean) => void;
  showViewerPanel:   boolean;
  setShowViewerPanel: (v: boolean) => void;
}

const ScreenShareContext = createContext<ScreenShareContextValue | null>(null);

export function useScreenShare() {
  const ctx = useContext(ScreenShareContext);
  if (!ctx) throw new Error('useScreenShare must be used inside ScreenShareProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────

export function ScreenShareProvider({ children }: { children: ReactNode }) {
  const { data: authSession, status } = useSession();
  const myId = (authSession?.user as any)?.id || null;
  const [mySession,            setMySession]            = useState<LiveSession | null>(null);
  const [incomingRequest,      setIncomingRequest]      = useState<LiveSession | null>(null);
  const [liveHeartbeat,        setLiveHeartbeat]        = useState<LiveHeartbeat | null>(null);
  const [isStale,              setIsStale]              = useState(false);
  const [secondsSinceLastBeat, setSecondsSinceLastBeat] = useState<number | null>(null);
  const [showRequestModal,     setShowRequestModal]     = useState(false);
  const [showViewerPanel,      setShowViewerPanel]      = useState(false);

  const iAmViewer = !!mySession && mySession.requesterId === myId;
  const iAmTarget = !!mySession && mySession.targetId    === myId;
  const isActive  = mySession?.status === 'ACTIVE';

  // ── Broadcast (target sends heartbeats) ──────────────────────
  useScreenShareBroadcast({ active: iAmTarget && isActive });

  // ── Poll: incoming requests (runs for all users) ─────────────
  const pollPending = useCallback(async () => {
    if (!myId) return;
    try {
      const res  = await fetch('/api/screenshare/pending');
      const data = await res.json();
      if (!res.ok) return;

      if (data.incoming) {
        if (data.incoming.status === 'PENDING') {
          setIncomingRequest(data.incoming as LiveSession);
          setMySession(data.incoming as LiveSession);
        } else if (data.incoming.status === 'ACTIVE') {
          setMySession(data.incoming as LiveSession);
          setIncomingRequest(null);
        } else {
          setIncomingRequest(null);
          if (mySession?.targetId === myId) setMySession(null);
        }
      } else {
        setIncomingRequest(null);
        if (iAmTarget) setMySession(null);
      }
    } catch {
      // Network hiccup — ignore
    }
  }, [myId, mySession, iAmTarget]);

  // ── Poll: viewer reads target's heartbeat ────────────────────
  const pollViewer = useCallback(async () => {
    if (!myId || !iAmViewer) return;
    try {
      const res  = await fetch('/api/screenshare/poll');
      const data = await res.json();

      if (!data.session) {
        setMySession(null);
        setLiveHeartbeat(null);
        setShowViewerPanel(false);
        return;
      }

      setMySession(data.session as LiveSession);

      if (data.session.status !== 'ACTIVE') {
        setLiveHeartbeat(null);
        return;
      }

      setShowViewerPanel(true);

      if (data.heartbeat) {
        setLiveHeartbeat(data.heartbeat as LiveHeartbeat);
      }
      setIsStale(data.stale ?? false);
      setSecondsSinceLastBeat(data.secondsSinceLastBeat ?? null);
    } catch {
      // Ignore
    }
  }, [myId, iAmViewer]);

  // ── Start/stop polling (FIXED: No more setInterval! No more click spam!) ─────────
  useEffect(() => {
    if (status !== 'authenticated' || !myId) return;

    // Only run when the component mounts
    pollPending();

    // Only refresh when the user comes back to the tab (prevents server spam)
    const handleFocus = () => pollPending();

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [status, myId, pollPending]);

  // Check if I am a viewer, and only then poll. 30 seconds is enough
  useEffect(() => {
    if (!iAmViewer) {
      return;
    }

    pollViewer();

    // Only poll viewer every 30 seconds OR on specific clicks
    const interval = setInterval(pollViewer, 30000); // 30 seconds

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [iAmViewer, pollViewer]);

  // ── Actions ───────────────────────────────────────────────────

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    const res  = await fetch('/api/screenshare/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return data.verified === true;
  }, []);

  const requestSession = useCallback(async (targetUserId: string) => {
    const res  = await fetch('/api/screenshare/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create session');
    setMySession(data.session as LiveSession);
    setShowRequestModal(false);
  }, []);

  const respondToRequest = useCallback(async (sessionId: string, action: 'ACCEPT' | 'REJECT') => {
    const res  = await fetch('/api/screenshare/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to respond');

    if (action === 'REJECT') {
      setIncomingRequest(null);
      setMySession(null);
    } else {
      setMySession(data.session as LiveSession);
      setIncomingRequest(null);
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!mySession) return;
    await fetch('/api/screenshare/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: mySession.id }),
    });
    setMySession(null);
    setIncomingRequest(null);
    setLiveHeartbeat(null);
    setShowViewerPanel(false);
  }, [mySession]);

  // ─── Context value ────────────────────────────────────────────

  const value: ScreenShareContextValue = {
    mySession, incomingRequest, liveHeartbeat, isStale, secondsSinceLastBeat,
    iAmViewer, iAmTarget, isActive,
    requestSession, respondToRequest, endSession, verifyPassword,
    showRequestModal, setShowRequestModal,
    showViewerPanel,  setShowViewerPanel,
  };

  return (
    <ScreenShareContext.Provider value={value}>
      {children}
    </ScreenShareContext.Provider>
  );
}