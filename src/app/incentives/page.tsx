"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { useToast } from "@/components/ui/ToastProvider";

type Recommendation = {
  id: string;
  segment: string;
  rank: number;
  performanceIndex: number;
  taskCount: number;
  avgScore: number | null;
  status: string;
  hrNote: string | null;
  user: { name: string; jobTitle: string | null; role: string; department: { name: string } | null };
};

const SEGMENT_LABELS: Record<string, string> = {
  FRONTLINE: "Staff",
  SUPERVISORY: "Supervisors",
  LEADERSHIP: "Leadership",
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING:      { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "Awaiting review" },
  ACKNOWLEDGED: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Acknowledged" },
  ACTIONED:     { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Actioned" },
  DISMISSED:    { bg: "#1a1d28", color: "#6b7280", border: "#374151", label: "Dismissed" },
};

export default function IncentivesPage() {
  const { showToast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/incentive-recommendations");
      const data = await res.json();
      if (res.ok) {
        setRecommendations(data.recommendations || []);
        setMonth(data.month || "");
      } else {
        showToast(data.error || "Couldn't load recommendations.", false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await fetch("/api/incentive-recommendations", { method: "POST" });
      await load();
      showToast("Refreshed with the latest data.");
    } finally {
      setRefreshing(false);
    }
  }

  async function act(id: string, status: "ACKNOWLEDGED" | "ACTIONED" | "DISMISSED") {
    setActingOn(id);
    try {
      const res = await fetch("/api/incentive-recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, hrNote: noteDrafts[id] || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Updated.");
        load();
      } else {
        showToast(data.error || "Something went wrong on our end. Try again shortly.", false);
      }
    } finally {
      setActingOn(null);
    }
  }

  const bySegment: Record<string, Recommendation[]> = { FRONTLINE: [], SUPERVISORY: [], LEADERSHIP: [] };
  for (const r of recommendations) bySegment[r.segment]?.push(r);

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", outline: "none",
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Incentive Recommendations
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {month ? `For ${month}` : "Loading…"} · top 10% per segment, based on verified logged work
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={refresh} disabled={refreshing}
              style={{ padding: "9px 18px", borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>
              {refreshing ? "Refreshing…" : "⟳ Refresh"}
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        <div style={{ background: "var(--accent-bg)", border: "0.5px solid var(--accent-border)", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: "var(--accent-text)", lineHeight: 1.5 }}>
          These are recommendations for recognition, not automatic rewards — reward and incentive decisions remain
          a human, policy-driven process. Disputed log entries are excluded, and rankings are quality-weighted, not
          just volume, matching the same rules as the staff leaderboard.
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
        ) : recommendations.length === 0 ? (
          <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>Nothing to recommend yet this month</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>Recommendations build up as staff log and get their work scored</div>
          </div>
        ) : (
          Object.keys(SEGMENT_LABELS).map((seg) => {
            const list = bySegment[seg] || [];
            if (list.length === 0) return null;
            return (
              <div key={seg} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                  {SEGMENT_LABELS[seg]}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {list.map((rec) => {
                    const ss = STATUS_STYLE[rec.status] || STATUS_STYLE.PENDING;
                    return (
                      <div key={rec.id} className="card-bg" style={{ borderRadius: 12, padding: "16px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                              #{rec.rank} · {rec.user.name}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              {rec.user.jobTitle || rec.user.role}{rec.user.department ? ` · ${rec.user.department.name}` : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: ss.bg, color: ss.color, border: `0.5px solid ${ss.border}` }}>
                            {ss.label}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                          <span>Index: <strong style={{ color: "#4ade80" }}>{rec.performanceIndex}</strong></span>
                          <span>Entries: {rec.taskCount}</span>
                          <span>Avg score: {rec.avgScore ?? "Unscored"}</span>
                        </div>

                        {rec.hrNote && (
                          <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-input)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                            {rec.hrNote}
                          </div>
                        )}

                        {rec.status === "PENDING" && (
                          <>
                            <input
                              style={{ ...inp, marginBottom: 8 }}
                              placeholder="Optional note (e.g. reward given, reason for dismissal)"
                              value={noteDrafts[rec.id] || ""}
                              onChange={(e) => setNoteDrafts((p) => ({ ...p, [rec.id]: e.target.value }))}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => act(rec.id, "ACKNOWLEDGED")} disabled={actingOn === rec.id}
                                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #1e3a5f", background: "#0c1a2e", color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                Acknowledge
                              </button>
                              <button onClick={() => act(rec.id, "ACTIONED")} disabled={actingOn === rec.id}
                                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #14532d", background: "#052e16", color: "#4ade80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                Mark actioned
                              </button>
                              <button onClick={() => act(rec.id, "DISMISSED")} disabled={actingOn === rec.id}
                                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #374151", background: "#1a1d28", color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                Dismiss
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
