"use client";

import { useState, useEffect } from "react";
import { enrollDevice, hasEnrolledDevice, listMyDevices, removeDevice } from "@/lib/webauthn-client";

export function BiometricEnrollment() {
  const [devices, setDevices] = useState<{ id: string; deviceLabel: string; createdAt: string }[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [message, setMessage] = useState({ text: "", ok: true });
  const [enrolling, setEnrolling] = useState(false);

  async function refreshDevices() {
    setDevices(await listMyDevices());
  }

  useEffect(() => {
    hasEnrolledDevice()
      .then((result) => setEnrolled(result))
      .finally(() => setLoading(false));
    refreshDevices();
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
      refreshDevices();
    } else {
      setMessage({ text: result.error || "Enrollment failed. Please try again.", ok: false });
    }
    setEnrolling(false);
  };

  if (loading) {
    return <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Checking enrollment status...</div>;
  }

  return (
    <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>
        Fingerprint / Face check-in
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        This confirms it's really you checking in — using your device's own fingerprint or face unlock.
        Nothing biometric is ever sent to or stored on our servers.
      </p>

      {/* ── DEVICE LIST ── */}
      {devices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
            Enrolled Devices ({devices.length})
          </div>
          {devices.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "0.5px solid var(--border-soft)",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  {d.deviceLabel}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-hint)" }}>
                  Enrolled {new Date(d.createdAt).toLocaleDateString("en-GB")}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm("Remove this device? You'll need a new code from IT to re-enroll.")) {
                    removeDevice(d.id).then(() => refreshDevices());
                  }
                }}
                style={{
                  fontSize: 12,
                  color: "#f87171",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── MESSAGE ── */}
      {message.text && (
        <div
          style={{
            fontSize: 13,
            color: message.ok ? "#4ade80" : "#f87171",
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: message.ok ? "#052e16" : "#1f0707",
            border: `0.5px solid ${message.ok ? "#14532d" : "#7f1d1d"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* ── CODE INPUT SECTION ── */}
      {!showCodeInput ? (
        <div
          style={{
            background: "var(--bg-input)",
            border: "0.5px solid var(--border)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
            {devices.length === 0
              ? "Not set up yet. For security, this has to be activated by IT — contact the IT department to get your setup code."
              : "Adding another device also requires a fresh code from IT."}
          </div>
          <button
            onClick={() => setShowCodeInput(true)}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            I have my code
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              style={{
                flex: 1,
                padding: "10px 12px",
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
            <button
              onClick={handleEnroll}
              disabled={enrolling || !activationCode}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "1.5px solid #22c55e",
                background: "#052e16",
                color: "#4ade80",
                fontWeight: 600,
                cursor: enrolling || !activationCode ? "not-allowed" : "pointer",
                opacity: enrolling || !activationCode ? 0.6 : 1,
              }}
            >
              {enrolling ? "Enrolling..." : "Enroll"}
            </button>
          </div>

          <input
            value={deviceLabel}
            onChange={(e) => setDeviceLabel(e.target.value)}
            placeholder="Device name (e.g., My Laptop)"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
          />

          <button
            onClick={() => {
              setShowCodeInput(false);
              setActivationCode("");
              setDeviceLabel("");
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "0.5px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}