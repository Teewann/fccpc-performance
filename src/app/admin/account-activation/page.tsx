"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function AccountActivationPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/account-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate code.");
      } else {
        setResult(data);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 max-w-lg">
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Generate account activation code</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          For a staff member who already has an account in the system (created via Users), enter their
          email below to generate a one-time code. Give it to them in person — they'll use it to set
          their own password.
        </p>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@fccpc.gov.ng"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", marginBottom: 12 }}
        />

        <button
          onClick={generate}
          disabled={busy || !email}
          style={{ padding: "11px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}
        >
          {busy ? "Generating..." : "Generate code"}
        </button>

        {error && <div style={{ color: "#f87171", marginTop: 16 }}>{error}</div>}

        {result && (
          <div className="card-bg" style={{ borderRadius: 12, padding: 20, marginTop: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Activation code for {email}</div>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, color: "#4ade80" }}>{result.code}</div>
            <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 8 }}>
              Expires {new Date(result.expiresAt).toLocaleString("en-GB")}. Give this to the staff member directly, not by email.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}