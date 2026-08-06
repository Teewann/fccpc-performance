"use client";
import { useState, useEffect } from "react";

type Step = "email" | "sent";

export default function ForgotPasswordPage() {
  const [step,       setStep]       = useState<Step>("email");
  const [email,      setEmail]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [dark,       setDark]       = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("fccpc-theme");
    setDark(saved !== "light");
  }, []);

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    localStorage.setItem("fccpc-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep("sent");
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const bg      = dark ? "#0a0c12" : "#f4f5f7";
  const cardBg  = dark ? "#13151e" : "#ffffff";
  const border  = dark ? "#1e2130" : "#e5e7eb";
  const text1   = dark ? "#f9fafb" : "#111827";
  const text2   = dark ? "#6b7280" : "#9ca3af";
  const inputBg = dark ? "#0a0c12" : "#f9fafb";

  return (
    <div style={{
      minHeight: "100vh", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, position: "relative", transition: "background 0.2s",
    }}>

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }} />

      {/* Glow */}
      <div style={{
        position: "fixed", pointerEvents: "none",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      }} />

      {/* Theme toggle top right */}
      <button
        onClick={toggleTheme}
        style={{
          position: "fixed", top: 20, right: 20,
          width: 42, height: 42, borderRadius: 12,
          background: cardBg, border: `0.5px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, cursor: "pointer", zIndex: 10,
        }}
        title={dark ? "Switch to light" : "Switch to dark"}
      >
        {dark ? "☀️" : "🌙"}
      </button>

      <div style={{ width: "100%", maxWidth: 440, position: "relative" }}>

        {/* Logo + header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: "#052e16", border: "2px solid #22c55e",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: "#22c55e" }}>FC</span>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: text1, letterSpacing: "-0.02em", textAlign: "center" }}>
            Reset password
          </h1>
          <p style={{ fontSize: 15, color: text2, marginTop: 8, textAlign: "center" }}>
            Federal Competition &amp; Consumer Protection Commission
          </p>
          <div style={{ width: 40, height: 2, background: "#22c55e", margin: "16px auto 0", borderRadius: 1 }} />
        </div>

        {/* Card */}
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: 18, padding: "36px 32px" }}>

          {step === "email" && (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: text1, marginBottom: 8, textAlign: "center" }}>
                Forgot your password?
              </h2>
              <p style={{ fontSize: 14, color: text2, marginBottom: 28, textAlign: "center", lineHeight: 1.7 }}>
                Enter your FCCPC email address. Your System Administrator will be notified and will reset your password and send new credentials to you.
              </p>

              <form onSubmit={handleSubmit}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: text2, marginBottom: 7 }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@fccpc.gov.ng"
                  required
                  style={{
                    width: "100%", background: inputBg,
                    border: `0.5px solid ${border}`,
                    borderRadius: 12, padding: "13px 16px",
                    fontSize: 15, color: text1, outline: "none",
                    boxSizing: "border-box", transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
                  onBlur={(e)  => (e.target.style.borderColor = border)}
                />

                {error && (
                  <div style={{
                    background: "#1f0707", border: "0.5px solid #7f1d1d",
                    borderRadius: 10, padding: "12px 14px",
                    fontSize: 14, color: "#f87171", margin: "16px 0",
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%", marginTop: 20,
                    background: submitting ? "#14532d" : "#166534",
                    border: "0.5px solid #22c55e",
                    borderRadius: 12, padding: 14,
                    fontSize: 15, fontWeight: 600, color: "#4ade80",
                    cursor: submitting ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {submitting ? "Sending request..." : "Send reset request"}
                </button>
              </form>
            </>
          )}

          {step === "sent" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 20 }}>📧</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: text1, marginBottom: 12 }}>
                Request submitted
              </h2>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, marginBottom: 24 }}>
                Your password reset request has been sent. Your System Administrator will reset your password and contact you at{" "}
                <strong style={{ color: text1 }}>{email}</strong> with your new login credentials.
              </p>
              <div style={{
                background: dark ? "#052e16" : "#f0fdf4",
                border: `0.5px solid ${dark ? "#14532d" : "#bbf7d0"}`,
                borderRadius: 12, padding: "14px 18px", marginBottom: 8,
              }}>
                <p style={{ fontSize: 14, color: dark ? "#4ade80" : "#166534", lineHeight: 1.6 }}>
                  If you need urgent access, contact your System Administrator directly or call the FCCPC ICT Unit helpdesk.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Back to login */}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <a
            href="/login"
            style={{ fontSize: 14, color: "#22c55e", textDecoration: "none", fontWeight: 500 }}
          >
            ← Back to sign in
          </a>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <p style={{ fontSize: 12, color: dark ? "#374151" : "#9ca3af" }}>
            FCCPC Performance Intelligence System v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
