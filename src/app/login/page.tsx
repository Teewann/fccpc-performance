'use client';
export const dynamic = "force-dynamic";

import { AGENCY } from "@/config/agency.config";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);
  const router = useRouter();

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  const bg = dark ? "#0a0c12" : "#f4f5f7";
  const cardBg = dark ? "#13151e" : "#ffffff";
  const border = dark ? "#1e2130" : "#e5e7eb";
  const text1 = dark ? "#f9fafb" : "#111827";
  const text2 = dark ? "#6b7280" : "#9ca3af";
  const inputBg = dark ? "#0a0c12" : "#f9fafb";

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
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
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
                width={70}
                height={70}
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>

          <h1
            style={{
              fontSize: 28,
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
              fontSize: 15,
              color: text2,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            {AGENCY.name}
          </p>

          <div
            style={{
              width: 40,
              height: 2,
              background: "#22c55e",
              margin: "16px auto 0",
              borderRadius: 1,
            }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            background: cardBg,
            border: `0.5px solid ${border}`,
            borderRadius: 18,
            padding: "36px 32px",
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: text1,
              marginBottom: 6,
              textAlign: "center",
            }}
          >
            Sign in to your account
          </h2>

          <p
            style={{
              fontSize: 14,
              color: text2,
              marginBottom: 28,
              textAlign: "center",
            }}
          >
            Enter your FCCPC credentials below
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: text2,
                  marginBottom: 7,
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
                style={{
                  width: "100%",
                  background: inputBg,
                  border: `0.5px solid ${border}`,
                  borderRadius: 12,
                  padding: "13px 16px",
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

            <div style={{ marginBottom: 8 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: text2,
                  marginBottom: 7,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                style={{
                  width: "100%",
                  background: inputBg,
                  border: `0.5px solid ${border}`,
                  borderRadius: 12,
                  padding: "13px 16px",
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

            <div style={{ textAlign: "right", marginBottom: 24 }}>
              <a
                href="/forgot-password"
                style={{
                  fontSize: 14,
                  color: "#22c55e",
                  cursor: "pointer",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Forgot password?
              </a>
            </div>

            {error && (
              <div
                style={{
                  background: "#1f0707",
                  border: "0.5px solid #7f1d1d",
                  borderRadius: 12,
                  padding: "13px 16px",
                  fontSize: 14,
                  color: "#f87171",
                  marginBottom: 18,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#14532d" : "#166534",
                border: "0.5px solid #22c55e",
                borderRadius: 12,
                padding: "14px",
                fontSize: 16,
                fontWeight: 600,
                color: "#4ade80",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p
            style={{
              fontSize: 13,
              color: dark ? "#374151" : "#9ca3af",
            }}
          >
            FCCPC Performance Intelligence System v1.0
          </p>
          <p
            style={{
              fontSize: 12,
              color: dark ? "#1f2937" : "#d1d5db",
              marginTop: 4,
            }}
          >
            Unauthorized access is strictly prohibited
          </p>
        </div>
      </div>
    </div>
  );
}