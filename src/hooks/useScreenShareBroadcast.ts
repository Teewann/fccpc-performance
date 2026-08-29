// hooks/useScreenShareBroadcast.ts
// ─────────────────────────────────────────────────────────────
// Used by the TARGET (person being watched).
// Captures page URL, clicks, actions and sends heartbeats.
// Call this in your ScreenShareProvider — it activates only
// when there is an active session where we are the target.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { maskInputValue, POLL_INTERVAL_MS, ClickEvent, ActionEvent, InputEvent } from '@/lib/screenshare';

interface UseBroadcastOptions {
  active: boolean; // only broadcast when there's an active session targeting us
}

export function useScreenShareBroadcast({ active }: UseBroadcastOptions) {
  const pathname = usePathname();

  // Refs so event handlers always have fresh data without re-registering
  const lastClickRef   = useRef<ClickEvent   | null>(null);
  const lastActionRef  = useRef<ActionEvent  | null>(null);
  const lastInputRef   = useRef<InputEvent   | null>(null);
  const scrollYRef     = useRef(0);
  const intervalRef    = useRef<NodeJS.Timeout | null>(null);

  // ── Event Capture ───────────────────────────────────────────

  const handleClick = useCallback((e: MouseEvent) => {
    if (!active) return;
    const target = e.target as HTMLElement;
    const selector = getSelector(target);
    const text = (target.textContent || target.getAttribute('aria-label') || '').trim().slice(0, 80);

    lastClickRef.current = {
      x: Math.round((e.clientX / window.innerWidth) * 100),  // % of viewport — privacy-safe
      y: Math.round((e.clientY / window.innerHeight) * 100),
      selector,
      text,
      timestamp: Date.now(),
    };

    // Also record as an action if it's a meaningful element
    const tag = target.tagName.toLowerCase();
    if (['button', 'a'].includes(tag) || target.getAttribute('role') === 'button') {
      lastActionRef.current = {
        type: tag === 'a' ? 'link_click' : 'button_click',
        detail: text || selector,
        timestamp: Date.now(),
      };
    }
  }, [active]);

  const handleScroll = useCallback(() => {
    if (!active) return;
    scrollYRef.current = window.scrollY;
  }, [active]);

  const handleInput = useCallback((e: Event) => {
    if (!active) return;
    const target = e.target as HTMLInputElement;
    const fieldName = target.name || target.id || target.placeholder || target.getAttribute('aria-label') || 'unknown';
    const masked = maskInputValue(fieldName, target.value);

    lastInputRef.current = {
      field: fieldName.slice(0, 40),
      maskedValue: masked,
      timestamp: Date.now(),
    };
  }, [active]);

  // Detect modal/dialog opens via MutationObserver
  const observerRef = useRef<MutationObserver | null>(null);
  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (node.getAttribute('role') === 'dialog' || node.classList.contains('modal')) {
              lastActionRef.current = {
                type: 'modal_open',
                detail: node.getAttribute('aria-label') || node.querySelector('h2,h3')?.textContent || 'Modal opened',
                timestamp: Date.now(),
              };
            }
          }
        }
      }
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });
  }, []);

  // ── Heartbeat sender ────────────────────────────────────────

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/screenshare/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUrl:  pathname,
          pageTitle:   document.title,
          clickEvent:  lastClickRef.current,
          actionEvent: lastActionRef.current,
          inputEvent:  lastInputRef.current,
          scrollY:     scrollYRef.current,
        }),
      });

      const data = await res.json();

      // If the server says session ended, clear state refs
      if (!data.active) {
        lastClickRef.current  = null;
        lastActionRef.current = null;
        lastInputRef.current  = null;
      }

      // Clear one-shot events after sending
      lastClickRef.current  = null;
      lastActionRef.current = null;
      lastInputRef.current  = null;
    } catch {
      // Network error — fail silently, don't crash the user's session
    }
  }, [pathname]);

  // ── Lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    if (!active) {
      // Clean up if we deactivate
      if (intervalRef.current) clearInterval(intervalRef.current);
      observerRef.current?.disconnect();
      return;
    }

    document.addEventListener('click',  handleClick,  true);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('input',  handleInput,  true);
    setupObserver();

    intervalRef.current = setInterval(sendHeartbeat, POLL_INTERVAL_MS);
    sendHeartbeat(); // send immediately on activation

    return () => {
      document.removeEventListener('click',  handleClick,  true);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('input',  handleInput,  true);
      observerRef.current?.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, handleClick, handleScroll, handleInput, setupObserver, sendHeartbeat]);
}

// ─── Helpers ─────────────────────────────────────────────────

/** Build a short CSS-selector-style description of an element */
function getSelector(el: HTMLElement): string {
  const tag  = el.tagName.toLowerCase();
  const id   = el.id   ? `#${el.id}`            : '';
  const cls  = el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
  return `${tag}${id}${cls}${role}`.slice(0, 60);
}