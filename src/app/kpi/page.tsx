"use client";

export const dynamic = "force-dynamic";


import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type KPI = {
  id: string;
  title: string;
  description: string | null;
  target: number;
  current: number;
  unit: string;
  period: string;
  startDate: string;
  endDate: string;
  percentage: number;
  status: "ON_TRACK" | "AT_RISK" | "BEHIND";
  daysLeft: number;
  department: { id: string; name: string };
};

type Department = { id: string; name: string; shortCode: string };

const statusConfig = {
  ON_TRACK: { label: "On track",  bg: "#052e16", color: "#4ade80", border: "#14532d" },
  AT_RISK:  { label: "At risk",   bg: "#1c1107", color: "#f59e0b", border: "#78350f" },
  BEHIND:   { label: "Behind",    bg: "#1f0707", color: "#f87171", border: "#7f1d1d" },
};

const barColor = {
  ON_TRACK: "#22c55e",
  AT_RISK:  "#f59e0b",
  BEHIND:   "#ef4444",
};

const periods = ["MONTHLY", "QUARTERLY", "ANNUAL"];

export default function KPIPage() {
  const [kpis, setKpis]               = useState<KPI[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<KPI | null>(null);
  const [filterDept, setFilterDept]   = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [msg, setMsg]                 = useState({ text: "", ok: true });
  const [updateVal, setUpdateVal]     = useState("");

  const [form, setForm] = useState({
    title: "", description: "", target: "", unit: "",
    departmentId: "", period: "MONTHLY",
    startDate: "", endDate: "",
  });

  useEffect(() => { fetchKPIs(); }, []);

  async function fetchKPIs() {
    setLoading(true);
    try {
      const res  = await fetch("/api/kpi");
      const data = await res.json();
      setKpis(data.kpis || []);
      setDepartments(data.departments || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/kpi", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "KPI created successfully.", ok: true });
        setForm({ title: "", description: "", target: "", unit: "", departmentId: "", period: "MONTHLY", startDate: "", endDate: "" });
        setShowForm(false);
        fetchKPIs();
      } else {
        setMsg({ text: data.error || "Failed to create KPI.", ok: false });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProgress() {
    if (!selected || !updateVal) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/kpi", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ kpiId: selected.id, current: updateVal }),
      });
      if (res.ok) {
        setMsg({ text: "Progress updated.", ok: true });
        setUpdateVal("");
        fetchKPIs();
        setSelected(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this KPI? This cannot be undone.")) return;
    await fetch(`/api/kpi?id=${id}`, { method: "DELETE" });
    fetchKPIs();
    if (selected?.id === id) setSelected(null);
  }

  const filtered = kpis.filter((k) => {
    const deptOk   = filterDept   === "ALL" || k.department.id   === filterDept;
    const statusOk = filterStatus === "ALL" || k.status === filterStatus;
    return deptOk && statusOk;
  });

  const counts = {
    total:    kpis.length,
    onTrack:  kpis.filter((k) => k.status === "ON_TRACK").length,
    atRisk:   kpis.filter((k) => k.status === "AT_RISK").length,
    behind:   kpis.filter((k) => k.status === "BEHIND").length,
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inputStyle = {
    width: "100%",
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 10,
    padding: "11px 14px",
    fontSize: 15,
    color: "var(--text-primary)" as const,
    outline: "none",
    boxSizing: "border-box" as const,
    marginBottom: 12,
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              KPI Manager
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today} · Q2 Performance Cycle</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => { setShowForm(!showForm); setMsg({ text: "", ok: true }); }}
              style={{
                background: "#052e16", border: "1.5px solid #22c55e",
                color: "#4ade80", fontSize: 14, fontWeight: 600,
                padding: "10px 20px", borderRadius: 10, cursor: "pointer",
              }}
            >
              {showForm ? "Cancel" : "+ New KPI"}
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total KPIs",   value: counts.total,   color: "var(--text-primary)" },
            { label: "On track",     value: counts.onTrack, color: "#4ade80" },
            { label: "At risk",      value: counts.atRisk,  color: "#f59e0b" },
            { label: "Behind",       value: counts.behind,  color: "#f87171" },
          ].map((s) => (
            <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 32, fontWeight: 600, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Create form (collapsible) */}
        {showForm && (
          <div className="card-bg" style={{ borderRadius: 14, padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, paddingBottom: 12, borderBottom: "0.5px solid var(--border-soft)" }}>
              Create new KPI
            </h2>
            {msg.text && (
              <div style={{
                background: msg.ok ? "var(--accent-bg)" : "#1f0707",
                border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`,
                color: msg.ok ? "var(--accent-text)" : "#f87171",
                borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16,
              }}>{msg.text}</div>
            )}
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>KPI Title *</label>
                  <input style={inputStyle} placeholder="e.g. Consumer complaints resolved per month"
                    value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Description (optional)</label>
                  <textarea style={{ ...inputStyle, resize: "none", minHeight: 70 } as any}
                    placeholder="Describe what this KPI measures and why it matters..."
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Department *</label>
                  <select style={inputStyle} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
                    <option value="">Select department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Period *</label>
                  <select style={inputStyle} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                    {periods.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Target value *</label>
                  <input style={inputStyle} type="number" placeholder="e.g. 100"
                    value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Unit *</label>
                  <input style={inputStyle} placeholder="Cases, Hours, %, Reports"
                    value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Start date *</label>
                  <input style={inputStyle} type="date"
                    value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>End date *</label>
                  <input style={inputStyle} type="date"
                    value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8, paddingTop: 16, borderTop: "0.5px solid var(--border-soft)" }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)",
                  background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer",
                }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{
                  padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e",
                  background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>{submitting ? "Creating..." : "Create KPI"}</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <select
            style={{ ...inputStyle, width: "auto", marginBottom: 0, fontSize: 14 }}
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="ALL">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {["ALL", "ON_TRACK", "AT_RISK", "BEHIND"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "9px 16px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                border: `0.5px solid ${filterStatus === s ? "var(--accent)" : "var(--border)"}`,
                background: filterStatus === s ? "var(--accent-bg)" : "var(--bg-card)",
                color: filterStatus === s ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {s === "ALL" ? "All" : s === "ON_TRACK" ? "On track" : s === "AT_RISK" ? "At risk" : "Behind"}
            </button>
          ))}
        </div>

        {/* KPI list + detail panel */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16 }}>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading KPIs...</div>
            ) : filtered.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No KPIs found</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Create your first KPI using the button above</div>
              </div>
            ) : (
              filtered.map((kpi) => {
                const sc = statusConfig[kpi.status];
                return (
                  <div
                    key={kpi.id}
                    onClick={() => { setSelected(selected?.id === kpi.id ? null : kpi); setUpdateVal(""); setMsg({ text: "", ok: true }); }}
                    className="card-bg"
                    style={{
                      borderRadius: 14,
                      padding: "18px 20px",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                      borderLeft: selected?.id === kpi.id ? "3px solid var(--accent)" : "3px solid transparent",
                      outline: `0.5px solid ${selected?.id === kpi.id ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.01em" }}>
                          {kpi.title}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          {kpi.department.name} · {kpi.period.charAt(0) + kpi.period.slice(1).toLowerCase()} · {kpi.daysLeft > 0 ? `${kpi.daysLeft} days left` : "Ended"}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
                        background: sc.bg, color: sc.color, border: `0.5px solid ${sc.border}`,
                        flexShrink: 0, marginLeft: 12,
                      }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Progress</span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                          {kpi.current} / {kpi.target} {kpi.unit}
                          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>
                            ({kpi.percentage}%)
                          </span>
                        </span>
                      </div>
                      <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 4,
                          width: `${Math.min(kpi.percentage, 100)}%`,
                          background: barColor[kpi.status],
                          transition: "width 0.3s",
                        }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-hint)" }}>
                      <span>Target: {kpi.target} {kpi.unit}</span>
                      <span>Start: {new Date(kpi.startDate).toLocaleDateString("en-GB")}</span>
                      <span>End: {new Date(kpi.endDate).toLocaleDateString("en-GB")}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail / update panel */}
          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 24, alignSelf: "start", position: "sticky", top: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>KPI Detail</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{selected.title}</div>
                {selected.description && (
                  <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>{selected.description}</div>
                )}
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.department.name}</div>
              </div>

              {/* Progress ring area */}
              <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 700, color: barColor[selected.status], letterSpacing: "-0.03em" }}>
                  {selected.percentage}%
                </div>
                <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                  {selected.current} of {selected.target} {selected.unit}
                </div>
                <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginTop: 12 }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${Math.min(selected.percentage, 100)}%`,
                    background: barColor[selected.status],
                  }} />
                </div>
              </div>

              {/* Update progress */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
                  Update current progress
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="number"
                    value={updateVal}
                    onChange={(e) => setUpdateVal(e.target.value)}
                    placeholder={`Current value (${selected.unit})`}
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  />
                  <button
                    onClick={handleUpdateProgress}
                    disabled={submitting || !updateVal}
                    style={{
                      padding: "11px 16px", borderRadius: 10, border: "1.5px solid #22c55e",
                      background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600,
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>

              {msg.text && (
                <div style={{
                  background: msg.ok ? "var(--accent-bg)" : "#1f0707",
                  border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`,
                  color: msg.ok ? "var(--accent-text)" : "#f87171",
                  borderRadius: 10, padding: "11px 14px", fontSize: 14, marginBottom: 16,
                }}>{msg.text}</div>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(selected.id)}
                style={{
                  width: "100%", padding: "10px", borderRadius: 10,
                  border: "0.5px solid #7f1d1d", background: "#1f0707",
                  color: "#f87171", fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                Delete this KPI
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
