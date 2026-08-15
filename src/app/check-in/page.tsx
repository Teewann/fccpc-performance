"use client";

export const dynamic = "force-dynamic";
import { verifyBiometric } from "@/lib/webauthn-client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
 import { captureFaceFromCamera, detectFaceInImage } from "@/lib/face-capture";

// ── Consent Gate Component ──────────────────────────────────────────
function ConsentGate({ children }: { children: React.ReactNode }) {
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);

  useEffect(() => {
    const consent = localStorage.getItem("fccpc-checkin-consent");
    if (consent === "true") {
      setHasConsented(true);
    } else {
      fetch("/api/check-in/consent")
        .then((res) => res.json())
        .then((data) => {
          if (data.hasConsented) {
            localStorage.setItem("fccpc-checkin-consent", "true");
            setHasConsented(true);
          } else {
            setHasConsented(false);
          }
        })
        .catch(() => setHasConsented(false));
    }
  }, []);

  const handleConsent = async () => {
    try {
      await fetch("/api/check-in/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      localStorage.setItem("fccpc-checkin-consent", "true");
      setHasConsented(true);
    } catch (error) {
      console.error("Failed to log consent:", error);
      localStorage.setItem("fccpc-checkin-consent", "true");
      setHasConsented(true);
    }
  };

  if (hasConsented === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-page)" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading...</div>
      </div>
    );
  }

  if (hasConsented === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            background: "var(--bg-card)",
            border: "0.5px solid var(--border)",
            borderRadius: 20,
            padding: "40px 36px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            Location Consent Required
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 12 }}>
            To check in, we need your consent to collect your <strong style={{ color: "var(--text-primary)" }}>IP address</strong> and <strong style={{ color: "var(--text-primary)" }}>GPS location</strong>.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-hint)", lineHeight: 1.6, marginBottom: 24 }}>
            This data is used solely to verify you are on FCCPC premises. It is logged for HR and security records and will not be shared with third parties.
          </p>

          <div
            style={{
              background: "var(--bg-input)",
              border: "0.5px solid var(--border)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 24,
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
              What we collect:
            </div>
            <ul style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 2, margin: 0, paddingLeft: 20 }}>
              <li>🌐 IP address (to confirm FCCPC network)</li>
              <li>📡 GPS coordinates (to confirm you are at FCCPC HQ)</li>
              <li>🕐 Timestamp of check-in</li>
            </ul>
          </div>

          <button
            onClick={handleConsent}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            I Understand — Proceed to Check-In
          </button>

          <p style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 16 }}>
            By clicking, you agree to the collection of your IP and GPS data for attendance verification.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ── Type definitions ──────────────────────────────────────────────────
type CheckInRecord = {
  id: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  hoursWorked: number | null;
  status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT";
  note: string | null;
  ipAddress?: string | null;
  isOnPremises?: boolean;
  locationMethod?: string | null;
};

type TeamMember = {
  id: string;
  userId: string;
  checkInAt: string;
  checkOutAt: string | null;
  hoursWorked: number | null;
  status: string;
  user: { id: string; name: string; role: string; department: { name: string } | null };
};

type AbsentStaff = {
  id: string;
  name: string;
  role: string;
  department: { name: string } | null;
};

type Summary = {
  present: number;
  late: number;
  halfDay: number;
  totalHrs: number;
  avgHrs: number;
};

// FCCPC HQ coordinates
const FCCPC_HQ = {
  lat: 9.048052,
  lng: 7.511101,
  radiusMeters: 60,
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PRESENT: { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Present" },
  LATE: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Late" },
  HALF_DAY: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Half day" },
  ABSENT: { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Absent" },
};

const FILTER_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  ALL: { bg: "#1a1a2e", color: "#c4b5fd", border: "#4c1d95", label: "All" },
  PRESENT: { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Present" },
  LATE: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Late" },
  HALF_DAY: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Half day" },
  ABSENT: { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Absent" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function elapsed(checkInAt: string) {
  const ms = Date.now() - new Date(checkInAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function QRCodeSVG({ value, size = 160 }: { value: string; size?: number }) {
  const [error, setError] = useState(false);
  const encoded = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=052e16&color=4ade80&margin=10`;

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          background: "#0a0c12",
          borderRadius: 12,
          border: "1px solid #14532d",
          maxWidth: size,
          wordBreak: "break-all",
          fontSize: 10,
          color: "#4ade80",
          fontFamily: "monospace",
        }}
      >
        {value}
      </div>
    );
  }

  return (
    <img
      src={qrUrl}
      alt="Check-in QR code"
      width={size}
      height={size}
      style={{ borderRadius: 12, display: "block" }}
      onError={() => setError(true)}
    />
  );
}

type LocationResult = {
  isOnPremises: boolean;
  method: string;
  gpsCoords?: { lat: number; lng: number };
  distanceMeters?: number;
  ipOnPremises?: boolean;
  gpsOnPremises?: boolean;
};

async function detectGPS(): Promise<{ lat: number; lng: number; distanceMeters: number; onPremises: boolean } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        const distanceMeters = haversineMeters(lat, lng, FCCPC_HQ.lat, FCCPC_HQ.lng);

        let effectiveRadius;
        if (accuracy < 30) effectiveRadius = 60;
        else if (accuracy < 100) effectiveRadius = 100;
        else if (accuracy < 300) effectiveRadius = 200;
        else effectiveRadius = 300;

        console.log(`📍 Accuracy: ±${Math.round(accuracy)}m → Radius: ${effectiveRadius}m → Distance: ${Math.round(distanceMeters)}m`);

        resolve({
          lat,
          lng,
          distanceMeters,
          onPremises: distanceMeters <= effectiveRadius,
        });
      },
      (err) => {
        console.error(`❌ GPS Error: ${err.message}`);
        resolve(null);
      },
      options
    );
  });
}

// ── Main Component ───────────────────────────────────────────────────
function CheckInContent() {
  const [today, setToday] = useState<CheckInRecord | null>(null);
  const [teamToday, setTeamToday] = useState<TeamMember[]>([]);
  const [absent, setAbsent] = useState<AbsentStaff[]>([]);
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<"checkin" | "team" | "history">("checkin");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [clock, setClock] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT">("ALL");

  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // ── QR Token and URL ──────────────────────────────────────────────
  const [qrToken] = useState(() =>
    `FCCPC-CHECKIN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  );
  const qrUrl = typeof window !== "undefined"
    ? `${window.location.origin}/check-in?qr=${qrToken}`
    : `/check-in?qr=${qrToken}`;

  // ── Derived values ────────────────────────────────────────────────
  const checkedIn = !!today?.checkInAt;
  const checkedOut = !!today?.checkOutAt;

  // ── useEffect Hooks ────────────────────────────────────────────────
  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/settings/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUserRole(d.user.role);
      })
      .catch(() => {});
  }, []);

  // ── QR Check-in useEffect ──────────────────────────────────────────
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("qr");
  console.log("🔍 QR param detected:", token);
  console.log("🔍 checkedIn status:", checkedIn);
  if (token && !checkedIn) {
    console.log("🔍 Calling handleQRCheckIn with:", token);
    handleQRCheckIn(token);
  }
}, [checkedIn]);

  const isPrivileged = ["ADMIN", "HR", "DIRECTOR", "EXECUTIVE"].includes(userRole);

  // ── QR Check-in Handler ──────────────────────────────────────────────
async function handleQRCheckIn(token: string) {
  console.log("🔵 QR token received:", token);
  setActing(true);
  try {
    console.log("📡 Sending to API:", "/api/check-in/qr");
    console.log("📦 Payload:", { token });
    
    const res = await fetch("/api/check-in/qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    
    console.log("📡 Response status:", res.status);
    console.log("📡 Response OK?", res.ok);
    
    const data = await res.json();
    console.log("📡 Response data:", data);

    if (res.ok) {
      setMsg({ text: "✅ QR check-in successful! Have a productive day!", ok: true });
      fetchToday();
      // Clear the QR param from URL
      window.history.replaceState({}, "", "/check-in");
    } else {
      setMsg({ text: data.error || "QR check-in failed. Please try manually.", ok: false });
    }
  } catch (error) {
    console.error("❌ QR check-in error:", error);
    setMsg({ text: "QR check-in failed. Please try manually.", ok: false });
  } finally {
    setActing(false);
  }
}

  const runLocationDetection = useCallback(async () => {
    setDetectingLocation(true);
    setGpsError("");

    let ipOnPremises = false;
    let gpsOnPremises = false;
    let gpsCoords: { lat: number; lng: number } | undefined;
    let distanceMeters: number | undefined;
    const methods: string[] = [];

    try {
      const res = await fetch("/api/check-in?view=location-check");
      const data = await res.json();
      if (res.ok) {
        ipOnPremises = data.isOnPremises === true;
        if (ipOnPremises) methods.push("IP");
      }
    } catch {
      // IP check failed — continue to GPS
    }

    const gps = await detectGPS();
    if (gps) {
      gpsOnPremises = gps.onPremises;
      gpsCoords = { lat: gps.lat, lng: gps.lng };
      distanceMeters = gps.distanceMeters;
      if (gpsOnPremises) methods.push("GPS");
      if (!gpsOnPremises && distanceMeters > FCCPC_HQ.radiusMeters) {
        setGpsError(`GPS: ${Math.round(distanceMeters)}m from FCCPC HQ (limit: ${FCCPC_HQ.radiusMeters}m)`);
      }
    } else {
      setGpsError("GPS unavailable or permission denied — IP only");
    }

    const isOnPremises = ipOnPremises || gpsOnPremises;
    const method = methods.length > 0 ? methods.join("+") : "UNVERIFIED";

    setLocationResult({ isOnPremises, method, gpsCoords, distanceMeters, ipOnPremises, gpsOnPremises });
    setDetectingLocation(false);

    return { isOnPremises, method, gpsCoords };
  }, []);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/check-in?view=today");
      const data = await res.json();
      setToday(data.today || null);
      setTeamToday(data.teamToday || []);
      setAbsent(data.absent || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/check-in?view=history");
    const data = await res.json();
    setHistory(data.records || []);
    setSummary(data.summary || null);
  }, []);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  useEffect(() => {
    if (tab === "checkin" && !locationResult && !detectingLocation) {
      runLocationDetection();
    }
  }, [tab]);

async function handleCheckIn() {
  setActing(true);
  setMsg({ text: "", ok: true });
  try {
    // ── Step 1: Capture Face ──────────────────────────────────────
    setMsg({ text: "📸 Capturing your face...", ok: true });
    const faceImage = await captureFaceFromCamera();
    
    if (!faceImage) {
      setMsg({ 
        text: "Face capture failed. Please allow camera access and try again.", 
        ok: false 
      });
      setActing(false);
      return;
    }

    // ── Step 2: Detect if there's a face in the image ──────────────
    const hasFace = await detectFaceInImage(faceImage);
    if (!hasFace) {
      setMsg({ 
        text: "No face detected in the captured image. Please try again.", 
        ok: false 
      });
      setActing(false);
      return;
    }

    // ── Step 3: Verify face against stored face ────────────────────
    setMsg({ text: "🔍 Verifying your face...", ok: true });
    const verifyRes = await fetch("/api/face/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faceImage }),
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyRes.ok || !verifyData.success) {
      setMsg({ 
        text: verifyData.error || "Face verification failed. Please try again.", 
        ok: false 
      });
      setActing(false);
      return;
    }

    // ── Step 4: Location check ──────────────────────────────────────
    setMsg({ text: "📍 Verifying your location...", ok: true });
    const loc = await runLocationDetection();

    // ── Step 5: Complete check-in ────────────────────────────────────
    setMsg({ text: "📝 Submitting check-in...", ok: true });
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note,
        gpsLat: loc?.gpsCoords?.lat,
        gpsLng: loc?.gpsCoords?.lng,
        isOnPremises: loc?.isOnPremises,
        locationMethod: loc?.method,
        faceVerified: true,
      }),
    });
    
    const data = await res.json();
    if (res.ok) {
      setMsg({ text: "✅ Successfully checked in! Have a productive day!", ok: true });
      setNote("");
      fetchToday();
    } else {
      setMsg({ text: data.error || "Failed to check in.", ok: false });
    }
  } catch (error) {
    console.error("Check-in error:", error);
    setMsg({ text: "An error occurred during check-in. Please try again.", ok: false });
  } finally {
    setActing(false);
  }
}

  async function handleCheckOut() {
    setActing(true);
    setMsg({ text: "", ok: true });
    try {
      const res = await fetch("/api/check-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({
          text: `Checked out successfully. Total: ${data.checkIn.hoursWorked}h worked today.`,
          ok: true,
        });
        setNote("");
        fetchToday();
      } else {
        setMsg({ text: data.error || "Failed to check out.", ok: false });
      }
    } finally {
      setActing(false);
    }
  }

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const filteredHistory =
    historyFilter === "ALL"
      ? history
      : history.filter((r) => r.status === historyFilter);

  function LocationBadge() {
    if (detectingLocation) {
      return (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 8,
            background: "var(--bg-input)",
            border: "0.5px solid var(--border)",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
          Verifying location...
        </div>
      );
    }
    if (!locationResult) return null;

    const { isOnPremises, method, distanceMeters, ipOnPremises, gpsOnPremises } = locationResult;

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 14px",
            borderRadius: 8,
            background: isOnPremises ? "#052e16" : "#1f0707",
            border: `0.5px solid ${isOnPremises ? "#14532d" : "#7f1d1d"}`,
            color: isOnPremises ? "#4ade80" : "#f87171",
          }}
        >
          {isOnPremises ? "📍 On-premises · FCCPC HQ" : "⚠️ Outside FCCPC premises"}
        </span>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <span
            style={{
              fontSize: 11,
              padding: "3px 9px",
              borderRadius: 6,
              fontWeight: 600,
              background: ipOnPremises ? "#052e16" : "#0a0c14",
              border: `0.5px solid ${ipOnPremises ? "#14532d" : "var(--border)"}`,
              color: ipOnPremises ? "#4ade80" : "var(--text-hint)",
            }}
          >
            🌐 IP: {ipOnPremises ? "FCCPC network" : "External"}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: "3px 9px",
              borderRadius: 6,
              fontWeight: 600,
              background: gpsOnPremises ? "#052e16" : "#0a0c14",
              border: `0.5px solid ${gpsOnPremises ? "#14532d" : "var(--border)"}`,
              color: gpsOnPremises ? "#4ade80" : "var(--text-hint)",
            }}
          >
            📡 GPS:{" "}
            {gpsOnPremises === undefined
              ? "Unavailable"
              : gpsOnPremises
              ? "Within HQ"
              : distanceMeters
              ? `${Math.round(distanceMeters)}m away`
              : "Outside range"}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: "3px 9px",
              borderRadius: 6,
              fontWeight: 500,
              background: "var(--bg-input)",
              border: "0.5px solid var(--border)",
              color: "var(--text-hint)",
            }}
          >
            Verified by: {method}
          </span>
        </div>

        {!isOnPremises && (
          <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2, textAlign: "center" }}>
            You can still check in, but your location will be recorded as outside premises
          </div>
        )}

        <button
          onClick={() => {
            setLocationResult(null);
            runLocationDetection();
          }}
          style={{
            fontSize: 12,
            color: "var(--text-hint)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Re-check location
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Daily Check-In
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{todayStr}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1.5px solid var(--accent-border)",
                borderRadius: 16,
                padding: "14px 24px",
                boxShadow: "0 0 18px rgba(34,197,94,0.12)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 14, color: "var(--accent-text)", opacity: 0.8 }}>🕐</span>
              <span
                style={{
                  fontFamily: "Calibri, 'Segoe UI', sans-serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                {clock
                  ? clock.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })
                  : "--:--:--"}
              </span>
            </div>
            <ThemeToggleButton />
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            background: "var(--bg-card)",
            border: "0.5px solid var(--border)",
            borderRadius: 12,
            padding: 4,
            width: "fit-content",
          }}
        >
          {([
            { key: "checkin", label: "My attendance" },
            ...(isPrivileged ? [{ key: "team", label: `Team today (${teamToday.length} in)` }] : []),
            { key: "history", label: "My history" },
          ] as { key: string; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{
                padding: "9px 22px",
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 500,
                background: tab === t.key ? "var(--accent-bg)" : "transparent",
                border: tab === t.key ? "0.5px solid var(--accent-border)" : "none",
                color: tab === t.key ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── My Attendance Tab ───────────────────────────────── */}
        {tab === "checkin" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
            {/* Left — main check-in panel */}
            <div>
              <div
                className="card-bg"
                style={{ borderRadius: 16, padding: 32, marginBottom: 20, textAlign: "center" }}
              >
                {loading ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 15 }}>Loading...</div>
                ) : !checkedIn ? (
                  <>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>🏢</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                      Not checked in yet
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
                      Work starts at 8:00 AM : check in before 8:15 AM to avoid a late mark
                    </div>
                  </>
                ) : !checkedOut ? (
                  <>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "#4ade80", marginBottom: 6 }}>
                      You are checked in
                    </div>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.02em",
                        marginBottom: 4,
                      }}
                    >
                      {elapsed(today!.checkInAt)}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      Checked in at {fmtTime(today!.checkInAt)}
                      {today!.status === "LATE" && (
                        <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>· Late</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 56, marginBottom: 12 }}>🌙</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                      Day complete
                    </div>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: "#22c55e",
                        letterSpacing: "-0.02em",
                        marginBottom: 4,
                      }}
                    >
                      {today!.hoursWorked}h
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                      {fmtTime(today!.checkInAt)} → {fmtTime(today!.checkOutAt!)}
                    </div>
                    {today?.status && (
                      <div style={{ marginTop: 12 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            padding: "5px 16px",
                            borderRadius: 8,
                            background: STATUS_STYLE[today.status]?.bg,
                            color: STATUS_STYLE[today.status]?.color,
                            border: `0.5px solid ${STATUS_STYLE[today.status]?.border}`,
                          }}
                        >
                          {STATUS_STYLE[today.status]?.label}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Location badge — shown when not yet checked out */}
                {!loading && !checkedOut && (
                  <div style={{ marginTop: 20 }}>
                    <LocationBadge />
                  </div>
                )}

                {/* Previous check-in location method */}
                {today && checkedIn && (
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    {today.ipAddress && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "4px 12px",
                          borderRadius: 6,
                          background: "var(--bg-input)",
                          border: "0.5px solid var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        IP: {today.ipAddress}
                      </span>
                    )}
                    {(today as any).locationMethod && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          padding: "4px 12px",
                          borderRadius: 6,
                          background: "var(--bg-input)",
                          border: "0.5px solid var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Verified via: {(today as any).locationMethod}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 6,
                        background: today.isOnPremises ? "#052e16" : "#1f0707",
                        border: `0.5px solid ${today.isOnPremises ? "#14532d" : "#7f1d1d"}`,
                        color: today.isOnPremises ? "#4ade80" : "#f87171",
                      }}
                    >
                      {today.isOnPremises ? "📍 On-premises" : "⚠️ Outside FCCPC"}
                    </span>
                  </div>
                )}
              </div>

              {/* Message */}
              {msg.text && (
                <div
                  style={{
                    background: msg.ok ? "#052e16" : "#1f0707",
                    border: `0.5px solid ${msg.ok ? "#14532d" : "#7f1d1d"}`,
                    color: msg.ok ? "#4ade80" : "#f87171",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  {msg.text}
                </div>
              )}

              {/* Note input */}
              {!checkedOut && (
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Note (optional)
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={checkedIn ? "Add a note for check-out..." : "e.g. Working from head office"}
                    autoComplete="off"
                    style={{
                      width: "100%",
                      background: "var(--bg-input)",
                      border: "0.5px solid var(--border)",
                      borderRadius: 10,
                      padding: "11px 14px",
                      fontSize: 14,
                      color: "var(--text-primary)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Action buttons */}
              {!checkedOut &&
                (!checkedIn ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={acting || detectingLocation}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: 12,
                      border: "1.5px solid #22c55e",
                      background: "#052e16",
                      color: "#4ade80",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: acting || detectingLocation ? "not-allowed" : "pointer",
                      opacity: detectingLocation ? 0.7 : 1,
                    }}
                  >
                    {acting ? "Checking in..." : detectingLocation ? "Verifying location..." : "✅ Check in now"}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={acting}
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: 12,
                      border: "1.5px solid #f59e0b",
                      background: "#1c1107",
                      color: "#f59e0b",
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: acting ? "not-allowed" : "pointer",
                    }}
                  >
                    {acting ? "Checking out..." : "🚪 Check out"}
                  </button>
                ))}
            </div>

            {/* Right — QR code panel */}
            {!checkedOut && (
              <div>
                <div className="card-bg" style={{ borderRadius: 16, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                    Quick scan check-in
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
                    Scan this QR code with your phone camera to check in instantly
                  </div>

                  <div
                    style={{
                      display: "inline-block",
                      padding: 12,
                      borderRadius: 14,
                      background: "#052e16",
                      border: "1.5px solid #14532d",
                      marginBottom: 14,
                    }}
                  >
                    <QRCodeSVG value={qrUrl} size={150} />
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-hint)",
                      marginBottom: 14,
                      wordBreak: "break-all",
                      lineHeight: 1.5,
                      background: "var(--bg-input)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      border: "0.5px solid var(--border)",
                    }}
                  >
                    {qrUrl}
                  </div>

                  {/* Refresh QR button */}
                  <button
                    onClick={() => {
                      window.location.reload();
                    }}
                    style={{
                      fontSize: 12,
                      color: "var(--text-hint)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      marginTop: 8,
                      marginBottom: 12,
                    }}
                  >
                    🔄 Refresh QR code
                  </button>

                  {/* Location summary in QR panel */}
                  <div
                    style={{
                      background: "var(--bg-input)",
                      border: "0.5px solid var(--border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Location check
                    </div>
                    {detectingLocation ? (
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Detecting...</div>
                    ) : locationResult ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>🌐 Network IP</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: locationResult.ipOnPremises ? "#4ade80" : "#f87171",
                            }}
                          >
                            {locationResult.ipOnPremises ? "FCCPC ✓" : "External"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--text-muted)" }}>📡 GPS</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: locationResult.gpsOnPremises
                                ? "#4ade80"
                                : locationResult.gpsCoords
                                ? "#f87171"
                                : "#94a3b8",
                            }}
                          >
                            {locationResult.gpsOnPremises
                              ? "Within HQ ✓"
                              : locationResult.distanceMeters
                              ? `${Math.round(locationResult.distanceMeters)}m away`
                              : "Unavailable"}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            padding: "6px 10px",
                            borderRadius: 7,
                            background: locationResult.isOnPremises ? "#052e16" : "#1f0707",
                            border: `0.5px solid ${locationResult.isOnPremises ? "#14532d" : "#7f1d1d"}`,
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: "center",
                            color: locationResult.isOnPremises ? "#4ade80" : "#f87171",
                          }}
                        >
                          {locationResult.isOnPremises ? "✓ On-premises confirmed" : "✗ Outside FCCPC"}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--text-hint)" }}>Location not yet checked</div>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-hint)",
                      marginTop: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    QR tokens expire after each session. Both IP and GPS are verified at check-in.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Team Today Tab ──────────────────────────────────── */}
        {tab === "team" && isPrivileged && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Checked in", value: teamToday.length, color: "#22c55e" },
                { label: "On time", value: teamToday.filter((t) => t.status === "PRESENT").length, color: "#4ade80" },
                { label: "Late", value: teamToday.filter((t) => t.status === "LATE").length, color: "#f59e0b" },
                { label: "Not in yet", value: absent.length, color: "#f87171" },
              ].map((s) => (
                <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* In office */}
              <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
                  In the office ({teamToday.length})
                </h2>
                {teamToday.length === 0 ? (
                  <div style={{ color: "var(--text-hint)", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
                    Nobody has checked in yet today
                  </div>
                ) : (
                  teamToday.map((t) => {
                    const ss = STATUS_STYLE[t.status] || STATUS_STYLE.PRESENT;
                    const initials = t.user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: "0.5px solid var(--border-soft)",
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: "var(--accent-bg)",
                            border: "1.5px solid var(--accent-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--accent-text)",
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {t.user.name}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            In: {fmtTime(t.checkInAt)}
                            {t.checkOutAt && ` · Out: ${fmtTime(t.checkOutAt)}`}
                            {t.hoursWorked && ` · ${t.hoursWorked}h`}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: ss.bg,
                            color: ss.color,
                            border: `0.5px solid ${ss.border}`,
                            flexShrink: 0,
                          }}
                        >
                          {ss.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Absent */}
              <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
                  Not checked in ({absent.length})
                </h2>
                {absent.length === 0 ? (
                  <div style={{ color: "#22c55e", fontSize: 14, textAlign: "center", padding: "16px 0" }}>
                    🎉 All staff have checked in today
                  </div>
                ) : (
                  absent.map((s) => {
                    const initials = s.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 0",
                          borderBottom: "0.5px solid var(--border-soft)",
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: "#1f0707",
                            border: "1.5px solid #7f1d1d",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#f87171",
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {s.name}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {s.department?.name || "No department"} ·{" "}
                            {s.role.charAt(0) + s.role.slice(1).toLowerCase()}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: "#1f0707",
                            color: "#f87171",
                            border: "0.5px solid #7f1d1d",
                            flexShrink: 0,
                          }}
                        >
                          Absent
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── History Tab ─────────────────────────────────────── */}
        {tab === "history" && (
          <div>
            {summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Days present", value: summary.present, color: "#22c55e" },
                  { label: "Days late", value: summary.late, color: "#f59e0b" },
                  { label: "Half days", value: summary.halfDay, color: "#60a5fa" },
                  { label: "Total hours", value: `${summary.totalHrs}h`, color: "#a78bfa" },
                  { label: "Avg per day", value: `${summary.avgHrs}h`, color: "var(--text-primary)" },
                ].map((s) => (
                  <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Filter by:</span>
              {(["ALL", "PRESENT", "LATE", "HALF_DAY", "ABSENT"] as const).map((f) => {
                const cs = FILTER_STYLE[f];
                const isActive = historyFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      border: isActive ? `1.5px solid ${cs.border}` : "0.5px solid var(--border)",
                      background: isActive ? cs.bg : "transparent",
                      color: isActive ? cs.color : "var(--text-muted)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {cs.label}
                  </button>
                );
              })}
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-hint)" }}>
                {filteredHistory.length} record{filteredHistory.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="card-bg" style={{ borderRadius: 14, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.8fr 1fr",
                  padding: "12px 20px",
                  borderBottom: "0.5px solid var(--border-soft)",
                  background: "var(--bg-input)",
                }}
              >
                {["Date", "Check in", "Check out", "Hours", "Status", "Note"].map((h) => (
                  <div
                    key={h}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {filteredHistory.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  {historyFilter === "ALL"
                    ? "No attendance records found for the last 30 days"
                    : `No records with status "${FILTER_STYLE[historyFilter]?.label || historyFilter}"`}
                </div>
              ) : (
                filteredHistory.map((r, i) => {
                  const ss = STATUS_STYLE[r.status] || STATUS_STYLE.PRESENT;
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.8fr 1fr",
                        padding: "13px 20px",
                        borderBottom: "0.5px solid var(--border-soft)",
                        background: i % 2 === 0 ? "transparent" : "var(--bg-input)",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                        {fmtDate(r.date)}
                      </div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{fmtTime(r.checkInAt)}</div>
                      <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                        {r.checkOutAt ? fmtTime(r.checkOutAt) : "—"}
                      </div>
                      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
                        {r.hoursWorked ? `${r.hoursWorked}h` : "—"}
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: ss.bg,
                            color: ss.color,
                            border: `0.5px solid ${ss.border}`,
                          }}
                        >
                          {ss.label}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-hint)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.note || "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Export with Consent Gate ─────────────────────────────────────────
export default function CheckInPage() {
  return (
    <ConsentGate>
      <CheckInContent />
    </ConsentGate>
  );
}