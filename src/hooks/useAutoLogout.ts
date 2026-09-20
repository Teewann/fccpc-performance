"use client";
import { useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";

const STORAGE_KEY = "fccpc-session-timeout";
const DEFAULT_MINUTES = 30;

export const AUTO_LOGOUT_WARNING_EVENT = "fccpc-autologout-warning";
export const AUTO_LOGOUT_RESET_EVENT   = "fccpc-autologout-reset";

export function useAutoLogout() {
  const timerRef   = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  const getTimeout = useCallback(() => {
    if (typeof window === "undefined") return DEFAULT_MINUTES;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved) : DEFAULT_MINUTES;
  }, []);

  const logout = useCallback(() => {
    // Leading slash is required — otherwise NextAuth resolves it as a
    // relative path and redirects to /<current-path>/auth/login → 404.
    signOut({ callbackUrl: "/auth/login" });
  }, []);

  const resetTimer = useCallback(() => {
    const minutes = getTimeout();
    const ms      = minutes * 60 * 1000;
    const warnMs  = Math.max(ms - 60_000, 0);

    if (timerRef.current)   clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTO_LOGOUT_RESET_EVENT));
    }

    if (warnMs > 0) {
      warningRef.current = setTimeout(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(AUTO_LOGOUT_WARNING_EVENT));
        }
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
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (timerRef.current)   clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [resetTimer]);

  const stayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  return { stayLoggedIn };
}

export function getSessionTimeout(): number {
  if (typeof window === "undefined") return DEFAULT_MINUTES;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? parseInt(saved) : DEFAULT_MINUTES;
}

export function setSessionTimeout(minutes: number): void {
  localStorage.setItem(STORAGE_KEY, String(minutes));
}