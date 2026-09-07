"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { useToast } from "@/components/ui/ToastProvider";

type LogItem = {
  id: string;
  taskTitle: string;
  description: string;
  createdAt: string;
  loggedByProxy: boolean;
  crossDeptFlag: string | null;
  user: { id: string; name: string; department: { name: string } | null };
  proxyLoggedBy: { name: string } | null;
};

type Anomaly = {
  supervisorId: string;
  name: string;
  department: string | null;
  avgScoreGiven: number;
  orgAverage: number | null;
  sampleSize: number;
  direction: string;
};

export default function HROversightPage() {
  const { showToast } = useToast();
  const [disputedLogs, setDisputedLogs] = useState<LogItem[]>([]);
  const [stalePending, setStalePending] = useState<LogItem[]>([]);
  const [scoringAnomalies, setScoringAnomalies] = useState<Anomaly[]>([]);
  const [orgAverage, setOrgAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"disputes" | "stale" | "anomalies">("disputes");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/hr-oversight");
      const data = await res.json();
      if (res.ok) {
        setDisputedLogs(data.disputedLogs || []);
        setStalePending(data.stalePending || []);
        setScoringAnomalies(data.scoringAnomalies || []);
        setOrgAverage(data.orgAverage);
      } else {
        showToast(data.error || "Couldn't load oversight data.", false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(logId: string, action: "resolve" | "remind") {
    setActingOn(logId);
    try {
      const res = await fetch("/api/hr-oversight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, action, note: noteDrafts[logId] }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(action === "resolve" ? "Marked resolved." : "Reminder sent.");
        load();
      } else {
        showToast(data.error || "Something went wrong on our end. Try again shortly.", false);
      }
    } finally {
      setActingOn(null);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", outline: "none",
  };

  const tabBtn = (key: typeof tab, label: string, count: number) => (
    <button key={key} onClick={() => setTab(key)}
      style={{
        padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: `1.5px solid ${tab === key ? "#60a5fa" : "var(--border)"}`,
        background: tab === key ? "#0c1a2e" : "var(--bg-input)",
        color: tab === key ? "#60a5fa" : "var(--text-muted)",
      }}>
      {label}
      {count > 0 && (
        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, padding: "1px 8px", borderRadius: 20, background: "#7f1d1d", color: "#f87171" }}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              HR Oversight
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              Org-wide disputes, stuck confirmations, and scoring consistency
            </p>
          </div>
          <ThemeToggleButton />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {tabBtn("disputes", "Disputed logs", disputedLogs.length)}
          {tabBtn("stale", "Stuck confirmations", stalePending.length)}
          {tabBtn("anomalies", "Scoring anomalies", scoringAnomalies.length)}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
        ) : (
          <>
            {tab === "disputes" && (
              disputedLogs.length === 0 ? (
                <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>No open disputes</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {disputedLogs.map((log) => (
                    <div key={log.id} className="card-bg" style={{ borderRadius: 12, padding: "16px 20px" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{log.taskTitle}</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                        {log.user.name} · {log.user.department?.name || "No dept"}
                        {log.loggedByProxy && log.proxyLoggedBy && ` · logged by ${log.proxyLoggedBy.name}`}
                        {log.crossDeptFlag && ` · involves ${log.crossDeptFlag}`}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>{log.description}</div>
                      <input
                        style={{ ...inp, marginBottom: 8 }}
                        placeholder="Resolution note (what did you find, what's the outcome)"
                        value={noteDrafts[log.id] || ""}
                        onChange={(e) => setNoteDrafts((p) => ({ ...p, [log.id]: e.target.value }))}
                      />
                      <button onClick={() => act(log.id, "resolve")} disabled={actingOn === log.id}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "0.5px solid #14532d", background: "#052e16", color: "#4ade80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Mark resolved
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "stale" && (
              stalePending.length === 0 ? (
                <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Nothing stuck right now</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stalePending.map((log) => (
                    <div key={log.id} className="card-bg" style={{ borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{log.taskTitle}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          {log.user.name} · waiting since {new Date(log.createdAt).toLocaleDateString("en-GB")}
                        </div>
                      </div>
                      <button onClick={() => act(log.id, "remind")} disabled={actingOn === log.id}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "0.5px solid #78350f", background: "#1c1107", color: "#f59e0b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Send reminder
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "anomalies" && (
              <>
                {orgAverage != null && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                    Org-wide average score: <strong style={{ color: "var(--text-primary)" }}>{orgAverage}/100</strong> (last 60 days)
                  </div>
                )}
                {scoringAnomalies.length === 0 ? (
                  <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>No scoring outliers detected</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {scoringAnomalies.map((a) => (
                      <div key={a.supervisorId} className="card-bg" style={{ borderRadius: 12, padding: "16px 20px" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{a.department || "No dept"}</div>
                        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          Averages <strong style={{ color: a.direction === "above" ? "#4ade80" : "#f87171" }}>{a.avgScoreGiven}</strong> vs
                          org average {a.orgAverage} — {a.direction} average by a wide margin, across {a.sampleSize} reviews.
                          Worth a conversation, not necessarily wrongdoing.
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
