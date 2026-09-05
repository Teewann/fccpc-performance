// src/components/logging/LogModeHub.tsx
//
// Wraps every logging mode (Quick Capture, Manual, Timer, Repeat, Bulk,
// Proxy) behind one tab switcher, remembers the person's last-used mode,
// and hides Proxy from anyone who isn't a supervisor.
//
// Usage in check-in/page.tsx: replace the existing form JSX with
//   <LogModeHub
//     canProxyLog={isSupervisorRole}      // pass from session/role check
//     ManualForm={<YourExistingFormJSX />} // move your current form into its own component
//     onSubmitted={fetchTodayLogs}
//   />

"use client";

import { useState, useEffect, ReactNode } from "react";
import dynamic from "next/dynamic";

// Each mode's component code now loads only when that tab is actually
// opened, not bundled into the initial page load. Small loading fallback
// keeps the switch feeling instant without shipping unused JS upfront.
function ModeLoading() {
  return <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>;
}

const QuickCaptureLog = dynamic(() => import("@/components/QuickCaptureLog"), { loading: ModeLoading });
const TimerLog = dynamic(() => import("@/components/logging/TimerLog"), { loading: ModeLoading });
const RepeatLog = dynamic(() => import("@/components/logging/RepeatLog"), { loading: ModeLoading });
const BulkGridLog = dynamic(() => import("@/components/logging/BulkGridLog"), { loading: ModeLoading });
const ProxyLog = dynamic(() => import("@/components/logging/ProxyLog"), { loading: ModeLoading });

type Mode = "quick" | "manual" | "timer" | "repeat" | "bulk" | "proxy";

const MODES: { key: Mode; label: string; icon: string; proxyOnly?: boolean }[] = [
  { key: "quick", label: "Quick capture", icon: "⚡" },
  { key: "timer", label: "Timer", icon: "⏱" },
  { key: "repeat", label: "Repeat", icon: "🔁" },
  { key: "bulk", label: "Bulk entry", icon: "📊" },
  { key: "manual", label: "Manual form", icon: "✍️" },
  { key: "proxy", label: "Log for staff", icon: "🧑‍💼", proxyOnly: true },
];

const STORAGE_KEY = "fccpc-preferred-log-mode";

export default function LogModeHub({
  canProxyLog,
  ManualForm,
  onSubmitted,
}: {
  canProxyLog: boolean;
  ManualForm: ReactNode;
  onSubmitted: () => void;
}) {
  const [mode, setMode] = useState<Mode>("quick");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
    if (saved && MODES.some((m) => m.key === saved)) {
      if (saved !== "proxy" || canProxyLog) setMode(saved);
    }
  }, [canProxyLog]);

  function selectMode(m: Mode) {
    setMode(m);
    window.localStorage.setItem(STORAGE_KEY, m);
  }

  const visibleModes = MODES.filter((m) => !m.proxyOnly || canProxyLog);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {visibleModes.map((m) => (
          <button
            key={m.key}
            onClick={() => selectMode(m.key)}
            style={{
              padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1.5px solid ${mode === m.key ? "#60a5fa" : "var(--border)"}`,
              background: mode === m.key ? "#0c1a2e" : "var(--bg-input)",
              color: mode === m.key ? "#60a5fa" : "var(--text-muted)",
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <div className="card-bg" style={{ borderRadius: 14, padding: 24 }}>
        {mode === "quick" && <QuickCaptureLog onSubmitted={onSubmitted} onSwitchToManual={() => selectMode("manual")} />}
        {mode === "timer" && <TimerLog onSubmitted={onSubmitted} />}
        {mode === "repeat" && <RepeatLog onSubmitted={onSubmitted} />}
        {mode === "bulk" && <BulkGridLog onSubmitted={onSubmitted} />}
        {mode === "manual" && ManualForm}
        {mode === "proxy" && canProxyLog && <ProxyLog onSubmitted={onSubmitted} />}
      </div>
    </div>
  );
}