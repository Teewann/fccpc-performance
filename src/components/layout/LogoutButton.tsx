"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleConfirmLogout() {
    setShowConfirm(false);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "9px 12px",
          borderRadius: 9,
          border: "0.5px solid #7f1d1d",
          background: "#1f0707",
          color: "#f87171",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#2d0a0a";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#1f0707";
        }}
      >
        <span style={{ fontSize: 14 }}>⎋</span>
        Sign out
      </button>

      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "0.5px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              maxWidth: 360,
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 48px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚪</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              Sign out?
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
              You will be returned to the login screen.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "0.5px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-muted)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                style={{
                  padding: "10px 24px",
                  borderRadius: 10,
                  border: "0.5px solid #7f1d1d",
                  background: "#1f0707",
                  color: "#f87171",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}