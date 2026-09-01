"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Entry = {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  taskCount: number;
  avgScore: number | null;
  performanceIndex: number;
  rank: number;
};

type Segments = { FRONTLINE: Entry[]; SUPERVISORY: Entry[]; LEADERSHIP: Entry[] };

const SEGMENT_LABELS: Record<string, string> = {
  FRONTLINE: "Staff",
  SUPERVISORY: "Supervisors",
  LEADERSHIP: "Leadership",
};

export default function PerformancePage() {
  const [segments, setSegments] = useState<Segments>({ FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] });
  const [monthLabel, setMonthLabel] = useState("");
  const [tab, setTab] = useState<keyof Segments>("FRONTLINE");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    fetch("/api/settings/account").then((r) => r.json()).then((d) => {
      if (d.user) setCurrentUserId(d.user.id);
    });
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setSegments(d.segments || { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] });
        setMonthLabel(d.monthLabel || "");
      })
      .finally(() => setLoading(false));
  }, []);

  const list = segments[tab] || [];
  const RANK_COLOR = ["#fbbf24", "#cbd5e1", "#d97706"]; // top 3 subtle accent, not medal emoji — keeps it professional

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Performance
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {monthLabel ? `Ranked for ${monthLabel}` : "Loading…"} · quality-weighted, not just count
            </p>
          </div>
          <ThemeToggleButton />
        </div>

        <div style={{ background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--accent-text)", lineHeight: 1.5 }}>
          This ranks logged work weighted by supervisor scores, not raw volume — quantity alone doesn't move you up.
          Disputed entries are excluded. Top performers here are a signal for recognition, not an automatic decision.
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(Object.keys(SEGMENT_LABELS) as (keyof Segments)[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${tab === key ? "#60a5fa" : "var(--border)"}`,
                background: tab === key ? "#0c1a2e" : "var(--bg-input)",
                color: tab === key ? "#60a5fa" : "var(--text-muted)",
              }}
            >
              {SEGMENT_LABELS[key]}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: tab === key ? "#60a5fa22" : "var(--bg-card)", color: tab === key ? "#60a5fa" : "var(--text-muted)" }}>
                {segments[key]?.length || 0}
              </span>
            </button>
          ))}
        </div>

        <div className="card-bg" style={{ borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1.6fr 1fr 0.8fr 0.8fr 0.9fr", padding: "12px 20px", borderBottom: "0.5px solid var(--border-soft)", background: "var(--bg-input)" }}>
            {["Rank", "Name", "Department", "Entries", "Avg score", "Index"].map((h) => (
              <div key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", fontSize: 15, color: "var(--text-muted)" }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 56, textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>No logged work yet this month in this group</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Rankings fill in as staff submit daily logs</div>
            </div>
          ) : (
            list.map((entry) => {
              const isMe = entry.id === currentUserId;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "grid", gridTemplateColumns: "60px 1.6fr 1fr 0.8fr 0.8fr 0.9fr",
                    padding: "14px 20px", borderBottom: "0.5px solid var(--border-soft)",
                    background: isMe ? "var(--accent-bg)" : "transparent", alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: RANK_COLOR[entry.rank - 1] || "var(--text-muted)" }}>
                    #{entry.rank}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {entry.name}{isMe && <span style={{ marginLeft: 8, fontSize: 11, color: "#60a5fa" }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{entry.jobTitle || entry.role}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{entry.department || "—"}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{entry.taskCount}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{entry.avgScore ?? "Unscored"}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{entry.performanceIndex}</div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}