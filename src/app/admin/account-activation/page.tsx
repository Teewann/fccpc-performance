"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function AccountActivationPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!email.trim()) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch("/api/admin/activation-codes/account-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to generate code.");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const input = document.createElement("input");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 max-w-xl">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 700, 
            color: "var(--text-primary)",
            marginBottom: 6,
          }}>
            🔑 Account Activation
          </h1>
          <p style={{ 
            fontSize: 15, 
            color: "var(--text-muted)", 
            lineHeight: 1.6,
          }}>
            Generate a one-time activation code for a staff member. 
            They'll use this to set their own password.
          </p>
        </div>

        <div className="card-bg" style={{ 
          borderRadius: 12, 
          padding: 24,
          border: "0.5px solid var(--border)",
          background: "var(--bg-card)",
        }}>
          <label style={{ 
            fontSize: 14, 
            fontWeight: 600, 
            color: "var(--text-muted)",
            display: "block",
            marginBottom: 8,
          }}>
            Staff Email Address
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@fccpc.gov.ng"
              style={{ 
                flex: 1,
                minWidth: 180,
                padding: "10px 14px", 
                borderRadius: 10, 
                border: "1px solid var(--border)", 
                background: "var(--bg-input)", 
                fontSize: 15,
                color: "var(--text-primary)",
                outline: "none",
              }}
              onFocus={(e) => e.target.style.borderColor = "#22c55e"}
              onBlur={(e) => e.target.style.borderColor = "var(--border)"}
            />

            <button
              onClick={generate}
              disabled={busy || !email}
              style={{ 
                padding: "10px 22px", 
                borderRadius: 10, 
                border: "1px solid #22c55e", 
                background: busy || !email ? "#14532d" : "#052e16", 
                color: "#4ade80", 
                fontSize: 15, 
                fontWeight: 600, 
                cursor: busy || !email ? "not-allowed" : "pointer",
                opacity: busy || !email ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {busy ? "Generating..." : "Generate Code"}
            </button>
          </div>

          {error && (
            <div style={{ 
              color: "#f87171", 
              marginTop: 14, 
              padding: "10px 14px", 
              background: "#1f0707", 
              borderRadius: 8,
              border: "0.5px solid #7f1d1d",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              {error}
            </div>
          )}

          {result && (
            <div style={{ 
              borderRadius: 12, 
              padding: 20, 
              marginTop: 20,
              background: "#052e16",
              border: "1px solid #14532d",
            }}>
              <div style={{ 
                fontSize: 14, 
                color: "#4ade80", 
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}>
                <span>✅</span> Activation code generated for
                <strong style={{ color: "#4ade80" }}>{email}</strong>
              </div>

              <div style={{ 
                fontSize: 36, 
                fontWeight: 700, 
                letterSpacing: 6, 
                color: "#4ade80",
                fontFamily: "monospace",
                textAlign: "center",
                padding: "14px 0",
                background: "#0a0c12",
                borderRadius: 8,
                marginBottom: 12,
                border: "0.5px solid #14532d",
              }}>
                {result.code}
              </div>

              <div style={{ 
                display: "flex", 
                gap: 10, 
                flexWrap: "wrap",
                justifyContent: "center",
              }}>
                <button
                  onClick={() => copyToClipboard(result.code)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "1px solid #22c55e",
                    background: "transparent",
                    color: "#4ade80",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {copied ? "✅ Copied!" : "📋 Copy Code"}
                </button>

                <button
                  onClick={generate}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "1px solid #f87171",
                    background: "transparent",
                    color: "#f87171",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  🔄 Generate New
                </button>

                <button
                  onClick={() => {
                    setEmail("");
                    setResult(null);
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "1px solid #6b7280",
                    background: "transparent",
                    color: "#6b7280",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ✕ Clear
                </button>
              </div>

              <div style={{ 
                fontSize: 14, 
                color: "#f87171", 
                marginTop: 12,
                textAlign: "center",
                padding: "8px 14px",
                background: "#1f0707",
                borderRadius: 6,
                border: "0.5px solid #7f1d1d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}>
                <span>⏰</span>
                Expires: {new Date(result.expiresAt).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ 
          marginTop: 20,
          padding: "16px 20px",
          background: "#0c1a2e",
          borderRadius: 10,
          border: "0.5px solid #1e3a5f",
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "flex-start", 
            gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>📌</span>
            <div>
              <div style={{ 
                fontSize: 15, 
                fontWeight: 600, 
                color: "#60a5fa",
                marginBottom: 4,
              }}>
                How it works
              </div>
              <ul style={{ 
                fontSize: 14, 
                color: "#93b4d4", 
                lineHeight: 1.8,
                margin: 0,
                paddingLeft: 18,
              }}>
                <li>Generate a 6-digit code for any staff account</li>
                <li>Give the code to the staff member in person (not by email)</li>
                <li>They'll use it at <code style={{ background: "#0a0c12", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>/activate</code></li>
                <li>Code expires after 24 hours and can only be used once</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}