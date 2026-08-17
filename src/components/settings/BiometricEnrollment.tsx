"use client";

import { useState, useEffect } from "react";
import { checkActivationCode, enrollDevice, listMyDevices, removeDevice } from "@/lib/webauthn-client";
import { hasFaceEnrolled, removeFaceEnrollment } from "@/lib/biometric/face-client";
import FaceCaptureModal from "@/components/biometric/FaceCaptureModal";

type Device = { id: string; deviceLabel: string; createdAt: string };

export function BiometricEnrollment() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showCodeGate, setShowCodeGate] = useState(false);
  const [code, setCode] = useState("");
  const [unlockedForAction, setUnlockedForAction] = useState<"device" | "face" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });

  // Face capture modal state
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [pendingFaceCode, setPendingFaceCode] = useState<string | undefined>();

  async function refresh() {
    setLoading(true);
    const [d, f] = await Promise.all([listMyDevices(), hasFaceEnrolled()]);
    setDevices(d);
    setFaceEnrolled(f);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  // True once the person has set up AT LEAST ONE method, ever.
  const alreadyProven = devices.length > 0 || faceEnrolled;

  function startAction(action: "device" | "face") {
    setMsg({ text: "", ok: true });
    if (alreadyProven) {
      // Already vetted once — no code needed for the other method.
      runAction(action);
    } else {
      setUnlockedForAction(action);
      setShowCodeGate(true);
    }
  }

  async function confirmCodeAndRun() {
    setBusy(true);
    const check = await checkActivationCode(code);
    if (!check.valid) {
      setMsg({ text: check.error || "Invalid code.", ok: false });
      setBusy(false);
      return;
    }
    setShowCodeGate(false);
    await runAction(unlockedForAction!, code);
    setBusy(false);
  }

  async function runAction(action: "device" | "face", usedCode?: string) {
    setBusy(true);
    setMsg({ text: "", ok: true });

    if (action === "device") {
      const result = await enrollDevice(
        "Fingerprint Sensor",
        usedCode || "",
        alreadyProven
      );
      
      if (result.success) {
        setMsg({ text: "Fingerprint/Face unlock enrolled on this device.", ok: true });
        setCode("");
        refresh();
      } else {
        setMsg({ text: result.error || "Enrollment failed.", ok: false });
      }
      setBusy(false);
    } else {
      // Face enrollment - open the face capture modal
      setPendingFaceCode(usedCode);
      setShowFaceCapture(true);
      setBusy(false);
    }
  }

  // ─── Handle face capture from modal ──────────────────────────────────
  async function handleFaceCapture(imageData: string) {
    setShowFaceCapture(false);
    setBusy(true);
    setMsg({ text: "", ok: true });

    try {
      const res = await fetch("/api/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enroll",
          image: imageData,
          code: pendingFaceCode || code,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMsg({ text: "✅ Face enrolled successfully!", ok: true });
        setCode("");
        refresh();
      } else {
        setMsg({ text: data.error || "Face enrollment failed.", ok: false });
      }
    } catch (err) {
      console.error("Face enrollment error:", err);
      setMsg({ text: "Face enrollment failed. Please try again.", ok: false });
    }
    setBusy(false);
    setPendingFaceCode(undefined);
  }

  // ─── Handle remove device ────────────────────────────────────────────
  async function handleRemoveDevice(id: string) {
    if (!confirm("Remove this device? A new IT code will be needed only if this was your last enrolled method.")) return;
    const ok = await removeDevice(id);
    if (ok) refresh();
  }

  // ─── Handle remove face ──────────────────────────────────────────────
  async function handleRemoveFace() {
    if (!confirm("Remove your enrolled face data?")) return;
    const ok = await removeFaceEnrollment();
    if (ok) refresh();
  }

  if (loading) return <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>
        🔐 Check-in verification
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Choose one or both methods below. Nothing biometric ever leaves your device unencrypted.
      </p>

      {msg.text && (
        <div style={{ 
          fontSize: 13, 
          color: msg.ok ? "#4ade80" : "#f87171", 
          marginBottom: 16,
          padding: "10px 14px",
          borderRadius: 8,
          background: msg.ok ? "#052e16" : "#1f0707",
          border: `0.5px solid ${msg.ok ? "#14532d" : "#7f1d1d"}`,
        }}>
          {msg.text}
        </div>
      )}

      {/* ── DEVICE FINGERPRINT / FACE UNLOCK ── */}
      <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
          🔐 Fingerprint / Face unlock (device)
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          Uses your phone or laptop's own fingerprint/face sensor. Nothing biometric is sent to our servers.
        </div>

        {devices.length > 0 ? (
          devices.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "0.5px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{d.deviceLabel}</div>
                <div style={{ fontSize: 12, color: "var(--text-hint)" }}>Enrolled {new Date(d.createdAt).toLocaleDateString("en-GB")}</div>
              </div>
              <button onClick={() => handleRemoveDevice(d.id)} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
                Remove
              </button>
            </div>
          ))
        ) : (
          <button
            onClick={() => startAction("device")}
            disabled={busy}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 600, cursor: "pointer" }}
          >
            Set up fingerprint/face unlock
          </button>
        )}
      </div>

      {/* ── FACE VERIFICATION (CAMERA) ── */}
      <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
          📷 Face verification (camera)
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          A quick photo confirms your identity at check-in. Only a mathematical description of your
          face shape is stored, encrypted — never a viewable photo.
        </div>

        {faceEnrolled ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: "#4ade80" }}>✓ Face verification is active</div>
            <button onClick={handleRemoveFace} style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => startAction("face")}
            disabled={busy}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 600, cursor: "pointer" }}
          >
            Set up face verification
          </button>
        )}
      </div>

      {/* ── CODE GATE ── */}
      {showCodeGate && (
        <div style={{ 
          position: "fixed", 
          inset: 0, 
          background: "rgba(0,0,0,0.7)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          zIndex: 1000 
        }}>
          <div className="card-bg" style={{ borderRadius: 14, padding: 24, maxWidth: 360, width: "90%", background: "var(--bg-card)" }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-primary)", fontSize: 16 }}>
              Enter your setup code
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              This is your first time setting up check-in verification, so it needs one code from IT.
              After this, adding the other method won't need a code again.
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Enter 8-digit code"
              maxLength={8}
              style={{ 
                width: "100%", 
                padding: "10px 12px", 
                borderRadius: 8, 
                border: "0.5px solid var(--border)", 
                background: "var(--bg-input)", 
                marginBottom: 12, 
                boxSizing: "border-box",
                fontSize: 18,
                fontFamily: "monospace",
                letterSpacing: 4,
                color: "var(--text-primary)",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button 
                onClick={() => setShowCodeGate(false)} 
                style={{ 
                  padding: "9px 16px", 
                  borderRadius: 8, 
                  background: "none", 
                  border: "0.5px solid var(--border)", 
                  color: "var(--text-muted)", 
                  cursor: "pointer" 
                }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmCodeAndRun} 
                disabled={busy || !code} 
                style={{ 
                  padding: "9px 16px", 
                  borderRadius: 8, 
                  border: "1.5px solid #22c55e", 
                  background: "#052e16", 
                  color: "#4ade80", 
                  fontWeight: 600, 
                  cursor: busy || !code ? "not-allowed" : "pointer",
                  opacity: busy || !code ? 0.6 : 1,
                }}
              >
                {busy ? "Verifying..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FACE CAPTURE MODAL ── */}
      <FaceCaptureModal
        isOpen={showFaceCapture}
        onCapture={handleFaceCapture}
        onCancel={() => {
          setShowFaceCapture(false);
          setPendingFaceCode(undefined);
          setBusy(false);
        }}
      />
    </div>
  );
}