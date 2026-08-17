"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AGENCY } from "@/config/agency.config";

export default function ActivatePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [step, setStep] = useState<"form" | "success">("form");
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("fccpc-theme");
    setDark(saved !== "light");
    document.documentElement.setAttribute(
      "data-theme",
      saved !== "light" ? "dark" : "light"
    );
  }, []);

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    localStorage.setItem("fccpc-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function activate() {
    setMsg({ text: "", ok: true });

    if (!email.trim()) {
      setMsg({ text: "Please enter your work email.", ok: false });
      return;
    }

    if (!code.trim()) {
      setMsg({ text: "Please enter your activation code.", ok: false });
      return;
    }

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
        setMsg({ text: data.error || "Activation failed. Please try again.", ok: false });
        setBusy(false);
        return;
      }

      setMsg({ text: "✅ Account activated successfully!", ok: true });
      setStep("success");
    } catch {
      setMsg({ text: "Network error. Please try again.", ok: false });
      setBusy(false);
    } finally {
      setBusy(false);
    }
  }

  const bg = dark ? "#0a0c12" : "#f4f5f7";
  const cardBg = dark ? "#13151e" : "#ffffff";
  const border = dark ? "#1e2130" : "#e5e7eb";
  const text1 = dark ? "#f9fafb" : "#111827";
  const text2 = dark ? "#6b7280" : "#9ca3af";
  const inputBg = dark ? "#0a0c12" : "#f9fafb";
  const textHint = dark ? "#4b5563" : "#9ca3af";

  if (step === "success") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        <div
          style={{
            background: cardBg,
            border: `0.5px solid ${border}`,
            borderRadius: 18,
            padding: "48px 40px",
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: text1, marginBottom: 6 }}>
            Account Activated!
          </h1>
          <p style={{ fontSize: 15, color: text2, marginBottom: 24 }}>
            Your account has been successfully activated. You can now log in.
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        transition: "background 0.2s",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(34,197,94,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(34,197,94,0.03) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow */}
      <div
        style={{
          position: "fixed",
          pointerEvents: "none",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />

      {/* WATERMARK */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 0,
        }}
      >
        <Image
          src="/fccpc-logo.jpg"
          alt="FCCPC Watermark"
          fill
          style={{
            objectFit: "contain",
            opacity: dark ? 0.18 : 0.22,
            filter: "none",
            userSelect: "none",
            pointerEvents: "none",
          }}
          priority
        />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 42,
          height: 42,
          borderRadius: 12,
          background: cardBg,
          border: `0.5px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          cursor: "pointer",
          zIndex: 10,
          transition: "all 0.15s",
        }}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {dark ? "☀️" : "🌙"}
      </button>

      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>
        {/* Logo + header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "#ffffff",
                border: "2px solid #22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: 4,
              }}
            >
              <Image
                src="/fccpc-logo.jpg"
                alt="FCCPC Logo"
                width={64}
                height={64}
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>

          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: text1,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              textAlign: "center",
            }}
          >
            {AGENCY.tagline}
          </h1>

          <p
            style={{
              fontSize: 14,
              color: text2,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {AGENCY.name}
          </p>

          <div
            style={{
              width: 36,
              height: 2,
              background: "#22c55e",
              margin: "12px auto 0",
              borderRadius: 1,
            }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            background: cardBg,
            border: `0.5px solid ${border}`,
            borderRadius: 16,
            padding: "28px 28px",
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#f87171",
              marginBottom: 4,
              textAlign: "center",
            }}
          >
            Activate Your Account
          </h2>

          <p
            style={{
              fontSize: 14,
              color: text2,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            Enter your work email, the code from IT, and choose a password.
          </p>

          {msg.text && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                marginBottom: 14,
                background: msg.ok ? "#052e16" : "#1f0707",
                border: `0.5px solid ${msg.ok ? "#14532d" : "#7f1d1d"}`,
                color: msg.ok ? "#4ade80" : "#f87171",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>{msg.ok ? "✅" : "⚠️"}</span>
              {msg.text}
            </div>
          )}

          <form 
            onSubmit={(e) => { e.preventDefault(); activate(); }}
            autoComplete="off"
          >
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: text2,
                  marginBottom: 5,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fccpc.gov.ng"
                required
                autoComplete="off"
                style={{
                  width: "100%",
                  background: inputBg,
                  border: `0.5px solid ${border}`,
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 15,
                  color: text1,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
                onBlur={(e) => (e.target.style.borderColor = border)}
              />
            </div>

            {/* Activation Code */}
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: text2,
                  marginBottom: 5,
                }}
              >
                Activation Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter 8-digit code"
                maxLength={8}
                autoComplete="off"
                style={{
                  width: "100%",
                  background: inputBg,
                  border: `0.5px solid ${border}`,
                  borderRadius: 10,
                  padding: "11px 14px",
                  fontSize: 18,
                  fontFamily: "monospace",
                  letterSpacing: 4,
                  color: text1,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
                onBlur={(e) => (e.target.style.borderColor = border)}
              />
            </div>

            {/* Password row - side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              {/* New Password */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: text2,
                    marginBottom: 5,
                  }}
                >
                  New Password
                  <span style={{ fontSize: 11, color: textHint, fontWeight: 400, marginLeft: 4 }}>
                    (min 8)
                  </span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{
                      width: "100%",
                      background: inputBg,
                      border: `0.5px solid ${border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      paddingRight: "36px",
                      fontSize: 15,
                      color: text1,
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
                    onBlur={(e) => (e.target.style.borderColor = border)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: textHint,
                      fontSize: 16,
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: text2,
                    marginBottom: 5,
                  }}
                >
                  Confirm Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{
                      width: "100%",
                      background: inputBg,
                      border: `0.5px solid ${border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      paddingRight: "36px",
                      fontSize: 15,
                      color: text1,
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#22c55e")}
                    onBlur={(e) => (e.target.style.borderColor = border)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: textHint,
                      fontSize: 16,
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "1.5px solid #22c55e",
                background: busy ? "#14532d" : "#166534",
                color: "#4ade80",
                fontSize: 16,
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {busy ? "Activating..." : "🔑 Activate Account"}
            </button>

            {/* Sign in link - immediately under button */}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <p style={{ fontSize: 14, color: text2 }}>
                Already have an account?{" "}
                <a
                  href="/auth/login"
                  style={{ color: "#22c55e", textDecoration: "none" }}
                >
                  Sign in
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <p
            style={{
              fontSize: 12,
              color: dark ? "#374151" : "#9ca3af",
            }}
          >
            FCCPC Performance Intelligence System v1.0
          </p>
          <p
            style={{
              fontSize: 11,
              color: dark ? "#1f2937" : "#d1d5db",
              marginTop: 2,
            }}
          >
            Unauthorized access is strictly prohibited
          </p>
        </div>
      </div>
    </div>
  );
}