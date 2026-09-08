"use client";
import { useState, useEffect } from "react";

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    const has = document.cookie.includes("checkin_consent=v1");
    setAccepted(has);
  }, []);

  async function accept() {
    document.cookie = "checkin_consent=v1; max-age=31536000; path=/";
    await fetch("/api/consent", { method: "POST" });
    setAccepted(true);
  }

  if (accepted === null) return null; // still checking, avoid flash
  if (accepted) return <>{children}</>;

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Before you check in</h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        This system records your check-in time, an approximate location (to confirm you're near
        the office), and asks your device to confirm it's really you using your fingerprint or
        face unlock. None of your actual biometric data is ever sent to or stored on our servers ;
        only a yes/no confirmation from your device. By continuing, you agree to this.
      </p>
      <button
        onClick={accept}
        style={{ padding: "10px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700 }}
      >
        I understand, continue
      </button>
    </div>
  );
}