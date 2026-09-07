// src/hooks/useScreenShareBroadcast.ts
import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface UseBroadcastOptions { active: boolean; }

export function useScreenShareBroadcast({ active }: UseBroadcastOptions) {
  const pathname = usePathname();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Send heartbeat ONLY for WebRTC connection health ──
  const sendHeartbeat = useCallback(async () => {
    if (!active) return;
    try {
      const res = await fetch('/api/screenshare/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUrl: pathname || '/',
          pageTitle: document.title || 'Screen Share',
          scrollY: window.scrollY || 0,
          // No more click/action/input tracking - pure screen sharing only
        }),
      });
      const data = await res.json();
      // If server says inactive, stop sending
      if (!data.active) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch {
      // Silently fail - connection will retry
    }
  }, [active, pathname]);

  // ── Keep WebRTC connection alive ──
  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send heartbeat immediately, then every 2 seconds
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 2000);

    // Also send when page becomes visible again (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [active, sendHeartbeat]);
}