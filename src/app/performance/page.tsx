"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Entry = {
  id: string;
  name: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  taskCount: number;
  approvedCount: number;
  completedTasks: number;
  overdueTasks: number;
  avgScore: number | null;
  performanceIndex: number;
  rank: number;
};

type Segments = { FRONTLINE: Entry[]; SUPERVISORY: Entry[]; LEADERSHIP: Entry[] };

type Filter = "today" | "week" | "month" | "year" | "custom";
type ViewMode = "active" | "all";

const SEGMENT_LABELS: Record<string, string> = {
  FRONTLINE: "Staff",
  SUPERVISORY: "Supervisors",
  LEADERSHIP: "Leadership",
};

const FILTER_LABELS: Record<Filter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom",
};

export default function PerformancePage() {
  const [segments, setSegments] = useState<Segments>({ FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] });
  const [monthLabel, setMonthLabel] = useState("");
  const [tab, setTab] = useState<keyof Segments>("FRONTLINE");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");

  const [filter, setFilter] = useState<Filter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("active");

  useEffect(() => {
    fetch("/api/settings/account").then((r) => r.json()).then((d) => {
      if (d.user) setCurrentUserId(d.user.id);
    });
  }, []);

  const fetchLeaderboard = useCallback(async (f: Filter, from?: string, to?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter: f });
      if (f === "custom" && from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/leaderboard?${params}`);
      const d = await res.json();
      setSegments(d.segments || { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] });
      setMonthLabel(d.monthLabel || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filter !== "custom") fetchLeaderboard(filter);
  }, [filter, fetchLeaderboard]);

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setFilter("custom");
    setShowPicker(false);
    fetchLeaderboard("custom", customFrom, customTo);
  }

  // Filter the current tab's list based on viewMode.
  // "Active" = has approved logs OR completed tasks
  const rawList = segments[tab] || [];
  const list = viewMode === "active"
    ? rawList.filter((e) => e.approvedCount > 0 || e.completedTasks > 0)
    : rawList;

  const RANK_COLOR = ["#fbbf24", "#cbd5e1", "#d97706"];

  const filterBtn = (f: Filter) => {
    const active = filter === f && f !== "custom";
    return (
      <button
        key={f}
        onClick={() => { setFilter(f); setShowPicker(false); }}
        style={{
          padding: "9px 20px",
          borderRadius: 9,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          border: active ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
          background: active ? "#052e16" : "var(--bg-card)",
          color: active ? "#4ade80" : "var(--text-muted)",
          transition: "all 0.15s",
        }}
      >
        {FILTER_LABELS[f]}
      </button>
    );
  };

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
          This ranks logged work weighted by supervisor scores, not raw volume ; quantity alone doesn't move you up.
          Disputed entries are excluded. Top performers here are a signal for recognition, not an automatic decision.
        </div>

        {/* ── Time range filter ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {(["today", "week", "month", "year"] as Filter[]).map(filterBtn)}
          <button
            onClick={() => setShowPicker((p) => !p)}
            style={{
              padding: "9px 20px",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              border: filter === "custom" ? "1.5px solid #22c55e" : "0.5px solid var(--border)",
              background: filter === "custom" ? "#052e16" : "var(--bg-card)",
              color: filter === "custom" ? "#4ade80" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            Custom range
          </button>

          {showPicker && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 10, background: "var(--bg-card)", border: "0.5px solid var(--border)" }}>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
              <span style={{ color: "var(--text-hint)", fontSize: 14 }}>to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
              <button onClick={applyCustom}
                style={{ padding: "6px 16px", borderRadius: 8, background: "#052e16", border: "1.5px solid #22c55e", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Apply
              </button>
            </div>
          )}

          {/* ── Active / All toggle ── */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, padding: 3, background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
            <button
              onClick={() => setViewMode("active")}
              style={{
                padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: viewMode === "active" ? "1.5px solid #60a5fa" : "1.5px solid transparent",
                background: viewMode === "active" ? "#0c1a2e" : "transparent",
                color: viewMode === "active" ? "#60a5fa" : "var(--text-muted)",
              }}
            >
              Active only
            </button>
            <button
              onClick={() => setViewMode("all")}
              style={{
                padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: viewMode === "all" ? "1.5px solid #60a5fa" : "1.5px solid transparent",
                background: viewMode === "all" ? "#0c1a2e" : "transparent",
                color: viewMode === "all" ? "#60a5fa" : "var(--text-muted)",
              }}
            >
              All staff
            </button>
          </div>
        </div>

        {/* ── Segment tabs ── */}
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
          <div style={{ display: "grid", gridTemplateColumns: "60px 1.5fr 1fr 0.7fr 0.7fr 0.8fr 0.8fr", padding: "12px 20px", borderBottom: "0.5px solid var(--border-soft)", background: "var(--bg-input)" }}>
            {["Rank", "Name", "Department", "Approved", "Tasks", "Avg score", "Score"].map((h) => (
              <div key={h} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", fontSize: 15, color: "var(--text-muted)" }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 56, textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
                {viewMode === "active" ? "No active staff in this period" : "No staff in this period"}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Try a wider range, or switch to "All staff"
              </div>
            </div>
          ) : (
            list.map((entry) => {
              const isMe = entry.id === currentUserId;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1.5fr 1fr 0.7fr 0.7fr 0.8fr 0.8fr",
                    padding: "14px 20px",
                    borderBottom: "0.5px solid var(--border-soft)",
                    background: isMe ? "var(--accent-bg)" : "transparent",
                    alignItems: "center",
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
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{entry.department || "-"}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{entry.approvedCount}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {entry.completedTasks}
                    {entry.overdueTasks > 0 && (
                      <span style={{ color: "#f87171", marginLeft: 4, fontSize: 12, fontWeight: 600 }}>
                        +{entry.overdueTasks}
                      </span>
                    )}
                  </div>
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