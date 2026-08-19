"use client";
import { useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";

const STORAGE_KEY = "fccpc-session-timeout";
const DEFAULT_MINUTES = 30;

export function useAutoLogout() {
  const timerRef    = useRef<NodeJS.Timeout | null>(null);
  const warningRef  = useRef<NodeJS.Timeout | null>(null);

  const getTimeout = useCallback(() => {
    if (typeof window === "undefined") return DEFAULT_MINUTES;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved) : DEFAULT_MINUTES;
  }, []);

  const logout = useCallback(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  const resetTimer = useCallback(() => {
    const minutes = getTimeout();
    const ms      = minutes * 60 * 1000;
    const warnMs  = ms - 60_000; // warn 1 minute before

    if (timerRef.current)   clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Show warning 1 minute before logout
    if (warnMs > 0) {
      warningRef.current = setTimeout(() => {
        const stay = window.confirm(
          `Your session will expire in 1 minute due to inactivity.\n\nClick OK to stay logged in.`
        );
        if (stay) resetTimer();
      }, warnMs);
    }

    timerRef.current = setTimeout(() => {
      logout();
    }, ms);
  }, [getTimeout, logout]);

  useEffect(() => {
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

    const handleActivity = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimer(); // start on mount

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (timerRef.current)   clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [resetTimer]);
}

// Utility - get current timeout setting
export function getSessionTimeout(): number {
  if (typeof window === "undefined") return DEFAULT_MINUTES;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseInt(saved) : DEFAULT_MINUTES;
}

// Utility - save timeout setting
export function setSessionTimeout(minutes: number): void {
  localStorage.setItem(STORAGE_KEY, String(minutes));
}