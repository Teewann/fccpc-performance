"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

type Reading = { label: string; lat: number; lng: number; accuracy: number };

const POINTS = ["North side", "South side", "East side", "West side", "Main gate", "Backyard", "Upper floor (sanity check)"];

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CalibrateLocationPage() {
  const [point, setPoint] = useState(POINTS[0]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  function captureOne() {
    setError("");
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos.coords.accuracy > 5000) {
          setError("That reading was too rough (network fallback, not real GPS). Ignored — try again.");
          setCapturing(false);
          return;
        }
        setReadings((r) => [...r, { label: point, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }]);
        setCapturing(false);
      },
      (err) => { setError(err.message); setCapturing(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Only ground-level perimeter points define the building's footprint.
  // Upper-floor readings are excluded from the center/radius calc — they're just a check.
  const perimeter = readings.filter((r) => r.label !== "Upper floor (sanity check)");
  const upperFloor = readings.filter((r) => r.label === "Upper floor (sanity check)");

  const center = perimeter.length
    ? {
        lat: perimeter.reduce((s, r) => s + r.lat, 0) / perimeter.length,
        lng: perimeter.reduce((s, r) => s + r.lng, 0) / perimeter.length,
      }
    : null;

  // Radius = distance from center to the farthest perimeter reading, plus its own GPS margin
  const radius = center
    ? Math.max(
        ...perimeter.map((r) => haversineMeters(center.lat, center.lng, r.lat, r.lng) + r.accuracy),
        ...upperFloor.map((r) => haversineMeters(center.lat, center.lng, r.lat, r.lng) + r.accuracy) // make sure upper floors fit too
      )
    : 0;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 max-w-2xl">
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Calibrate office location</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
          Walk to each point below, select it, and capture 3 readings there before moving to the next point.
        </p>

        <select value={point} onChange={(e) => setPoint(e.target.value)} style={{ marginBottom: 12, padding: 8, borderRadius: 8, width: "100%" }}>
          {POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <button onClick={captureOne} disabled={capturing} style={{ padding: "12px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer", marginBottom: 20 }}>
          {capturing ? "Reading GPS..." : `Capture reading at "${point}"`}
        </button>

        {error && <div style={{ color: "#f87171", marginBottom: 16 }}>{error}</div>}

        <div style={{ marginBottom: 20 }}>
          {readings.map((r, i) => (
            <div key={i} style={{ fontSize: 13, color: "var(--text-muted)", padding: "4px 0" }}>
              [{r.label}] {r.lat.toFixed(6)}, {r.lng.toFixed(6)} — ±{Math.round(r.accuracy)}m
            </div>
          ))}
        </div>

        {center && (
          <div className="card-bg" style={{ borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
              Center from {perimeter.length} perimeter readings — paste into agency.config.ts
            </div>
            <pre style={{ fontSize: 13, background: "var(--bg-input)", padding: 12, borderRadius: 8, overflowX: "auto" }}>
{`hqLocation: {
  lat: ${center.lat.toFixed(6)},
  lng: ${center.lng.toFixed(6)},
  radiusMeters: ${Math.round(radius)},
  address: "23 Jimmy Carter Street, Asokoro, Abuja",
},`}
            </pre>
            <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 8 }}>
              Radius = distance from the center to your farthest perimeter reading, plus that reading's own GPS margin.
              {upperFloor.length > 0 && " Includes your upper-floor sanity-check readings — they fit inside this radius."}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}