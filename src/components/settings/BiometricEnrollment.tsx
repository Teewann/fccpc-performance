"use client";

import { useState, useEffect } from "react";
import { enrollDevice, hasEnrolledDevice } from "@/lib/webauthn-client";

export function BiometricEnrollment() {
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [message, setMessage] = useState({ text: "", ok: true });
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    hasEnrolledDevice()
      .then((result) => setEnrolled(result))
      .finally(() => setLoading(false));
  }, []);

  const handleEnroll = async () => {
    if (!activationCode.trim()) {
      setMessage({ text: "Please enter your activation code from IT.", ok: false });
      return;
    }
    if (!deviceLabel.trim()) {
      setMessage({ text: "Please enter a name for this device (e.g., 'My Laptop').", ok: false });
      return;
    }

    setEnrolling(true);
    setMessage({ text: "", ok: true });

    const result = await enrollDevice(deviceLabel, activationCode);
    if (result.success) {
      setMessage({ text: "✅ Device enrolled successfully!", ok: true });
      setEnrolled(true);
      setShowCodeInput(false);
      setActivationCode("");
    } else {
      setMessage({ text: result.error || "Enrollment failed. Please try again.", ok: false });
    }
    setEnrolling(false);
  };

  if (loading) {
    return <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Checking enrollment status...</div>;
  }

  if (enrolled) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#4ade80" }}>Biometric check-in is enabled</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Your device is enrolled for fingerprint/face verification.
        </p>
      </div>
    );
  }

  if (!showCodeInput) {
    return (
      <div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>
          Fingerprint/Face check-in isn't set up yet. Contact IT to get your activation code.
        </div>
        <button
          onClick={() => setShowCodeInput(true)}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1.5px solid #22c55e",
            background: "#052e16",
            color: "#4ade80",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          I have my activation code
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        Enter the 6-digit activation code from IT and give this device a name.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
          Activation Code
        </label>
        <input
          type="text"
          value={activationCode}
          onChange={(e) => setActivationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "0.5px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: 16,
            fontFamily: "monospace",
            letterSpacing: "4px",
            outline: "none",
          }}
          maxLength={6}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
          Device Name
        </label>
        <input
          type="text"
          value={deviceLabel}
          onChange={(e) => setDeviceLabel(e.target.value)}
          placeholder="e.g., My Laptop, Office PC, Work Phone"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "0.5px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      {message.text && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: message.ok ? "#052e16" : "#1f0707",
            border: `0.5px solid ${message.ok ? "#14532d" : "#7f1d1d"}`,
            color: message.ok ? "#4ade80" : "#f87171",
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setShowCodeInput(false)}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "0.5px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-muted)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleEnroll}
          disabled={enrolling || !activationCode || !deviceLabel}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "1.5px solid #22c55e",
            background: "#052e16",
            color: "#4ade80",
            fontSize: 14,
            fontWeight: 600,
            cursor: enrolling || !activationCode || !deviceLabel ? "not-allowed" : "pointer",
            opacity: enrolling || !activationCode || !deviceLabel ? 0.6 : 1,
          }}
        >
          {enrolling ? "Enrolling..." : "Enroll Device"}
        </button>
      </div>
    </div>
  );
}