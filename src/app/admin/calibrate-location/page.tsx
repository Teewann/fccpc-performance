"use client";

import { useState, useRef } from "react";
import Sidebar from "@/components/layout/Sidebar";

type Reading = { lat: number; lng: number; accuracy: number };

export default function CalibrateLocationPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const watchId = useRef<number | null>(null);

  function captureOne() {
    setError("");
    setCapturing(true);
    if (!navigator.geolocation) {
      setError("This device/browser doesn't support GPS.");
      setCapturing(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setReadings((r) => [
          ...r,
          { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
        ]);
        setCapturing(false);
      },
      (err) => {
        setError(err.message || "Could not get GPS position.");
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Weighted average — readings with better (smaller) accuracy count more
  const avg = readings.length
    ? (() => {
        const weights = readings.map((r) => 1 / Math.max(r.accuracy, 1));
        const totalW = weights.reduce((a, b) => a + b, 0);
        const lat = readings.reduce((s, r, i) => s + r.lat * weights[i], 0) / totalW;
        const lng = readings.reduce((s, r, i) => s + r.lng * weights[i], 0) / totalW;
        const bestAccuracy = Math.min(...readings.map((r) => r.accuracy));
        return { lat, lng, bestAccuracy };
      })()
    : null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 max-w-2xl">
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Calibrate office location</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Stand inside the FCCPC building (near where staff normally sit, not just outside the gate),
          keep this page open, and tap "Capture reading" 5–8 times over a minute or two. GPS drifts,
          so more readings, spread over time, give a much more reliable fix than one reading.
        </p>

        <button
          onClick={captureOne}
          disabled={capturing}
          style={{
            padding: "12px 24px", borderRadius: 10, border: "1.5px solid #22c55e",
            background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer", marginBottom: 20,
          }}
        >
          {capturing ? "Reading GPS..." : "Capture reading"}
        </button>

        {error && <div style={{ color: "#f87171", marginBottom: 16 }}>{error}</div>}

        <div style={{ marginBottom: 20 }}>
          {readings.map((r, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--text-muted)", padding: "4px 0" }}>
              #{i + 1}: {r.lat.toFixed(6)}, {r.lng.toFixed(6)} — accuracy ±{Math.round(r.accuracy)}m
            </div>
          ))}
        </div>

        {avg && (
          <div className="card-bg" style={{ borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
              Weighted average from {readings.length} reading{readings.length > 1 ? "s" : ""} — paste into agency.config.ts
            </div>
            <pre style={{ fontSize: 13, background: "var(--bg-input)", padding: 12, borderRadius: 8, overflowX: "auto" }}>
{`hqLocation: {
  lat: ${avg.lat.toFixed(6)},
  lng: ${avg.lng.toFixed(6)},
  radiusMeters: ${Math.max(100, Math.round(avg.bestAccuracy * 3))}, // scaled to your device's GPS accuracy
  address: "23 Jimmy Carter Street, Asokoro, Abuja",
},`}
            </pre>
            <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 8 }}>
              Best single-reading accuracy was ±{Math.round(avg.bestAccuracy)}m. The radius above gives that
              a 3x margin so normal GPS drift inside the building doesn't get flagged as "outside."
              Capture readings from a couple of different staff phones if you can — Android/iPhone GPS chips vary.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}