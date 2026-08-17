"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivatePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });

  async function activate() {
    setMsg({ text: "", ok: true });
    if (newPassword.length < 8) {
      setMsg({ text: "Password must be at least 8 characters.", ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: "Passwords don't match.", ok: false });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || "Activation failed.", ok: false });
      } else {
        setMsg({ text: "Account activated. Redirecting to login...", ok: true });
        setTimeout(() => router.push("/auth/login"), 1500);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Activate your account</h1>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>
        Enter your work email, the code IT gave you, and choose your own password.
      </p>

      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your work email"
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", marginBottom: 12 }} />
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code from IT"
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", marginBottom: 12 }} />
      <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Choose a new password"
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", marginBottom: 12 }} />
      <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password"
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #333", marginBottom: 16 }} />

      {msg.text && <div style={{ color: msg.ok ? "#4ade80" : "#f87171", marginBottom: 16 }}>{msg.text}</div>}

      <button onClick={activate} disabled={busy}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
        {busy ? "Activating..." : "Activate account"}
      </button>
    </div>
  );
}