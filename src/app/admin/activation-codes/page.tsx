"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function ActivationCodesPage() {
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/users?limit=500")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => setMessage("Failed to load users"));
  }, []);

  const generateCode = async () => {
    if (!selectedUser) {
      setMessage("Please select a staff member");
      return;
    }

    setLoading(true);
    setMessage("");
    setGeneratedCode("");

    try {
      const res = await fetch("/api/admin/activation-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser }),
      });
      const data = await res.json();

      if (res.ok) {
        setGeneratedCode(data.code);
        setMessage("Code generated successfully! Give this code to the staff member.");
      } else {
        setMessage(data.error || "Failed to generate code");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", marginBottom: 24 }}>
          Biometric Activation Codes
        </h1>

        <div className="card-bg" style={{ maxWidth: 500, borderRadius: 16, padding: 32 }}>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            Generate a one-time 6-digit code for a staff member to enable their fingerprint/face check-in.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
              Select Staff Member
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "0.5px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">- Select a user -</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={generateCode}
            disabled={loading || !selectedUser}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 8,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading || !selectedUser ? "not-allowed" : "pointer",
              opacity: loading || !selectedUser ? 0.6 : 1,
            }}
          >
            {loading ? "Generating..." : "Generate Code"}
          </button>

          {message && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 8,
                background: message.includes("success") ? "#052e16" : "#1f0707",
                border: `0.5px solid ${message.includes("success") ? "#14532d" : "#7f1d1d"}`,
                color: message.includes("success") ? "#4ade80" : "#f87171",
                fontSize: 14,
              }}
            >
              {message}
            </div>
          )}

          {generatedCode && (
            <div
              style={{
                marginTop: 16,
                padding: "20px",
                borderRadius: 8,
                background: "#0a0c14",
                border: "1.5px solid #22c55e",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Activation Code</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#4ade80", letterSpacing: "4px", fontFamily: "monospace" }}>
                {generatedCode}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                style={{
                  marginTop: 12,
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "0.5px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Copy to clipboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}