"use client";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  AUTO_LOGOUT_WARNING_EVENT,
  AUTO_LOGOUT_RESET_EVENT,
  getSessionTimeout,
} from "@/hooks/useAutoLogout";

export default function AutoLogoutModal() {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const onWarn = () => {
      setVisible(true);
      setSecondsLeft(60);
    };
    const onReset = () => setVisible(false);

    window.addEventListener(AUTO_LOGOUT_WARNING_EVENT, onWarn);
    window.addEventListener(AUTO_LOGOUT_RESET_EVENT, onReset);

    return () => {
      window.removeEventListener(AUTO_LOGOUT_WARNING_EVENT, onWarn);
      window.removeEventListener(AUTO_LOGOUT_RESET_EVENT, onReset);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setVisible(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => setVisible(false);
    window.addEventListener("focus", dismiss);
    return () => window.removeEventListener("focus", dismiss);
  }, [visible]);

  if (!visible) return null;

  const minutes = getSessionTimeout();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "0.5px solid var(--border)",
          borderRadius: 16,
          padding: 28,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#1c1107",
              border: "1.5px solid #78350f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            ⏱
          </div>
          <div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 2,
              }}
            >
              Session expiring soon
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              You have been idle for {minutes - 1} minute{minutes - 1 !== 1 ? "s" : ""}.
            </div>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-input)",
            border: "0.5px solid var(--border)",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 600,
            }}
          >
            Auto sign-out in
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#f59e0b",
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {secondsLeft}s
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setVisible(false)}
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: 10,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Stay signed in
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            style={{
              padding: "11px 20px",
              borderRadius: 10,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}