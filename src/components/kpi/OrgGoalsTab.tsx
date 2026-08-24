"use client";
import { useState, useEffect } from "react";

type Contribution = { id: string; current: number; target: number; department: { name: string }; sourceType: string };
type Goal = { id: string; title: string; description: string | null; totalTarget: number; totalCurrent: number; unit: string; year: number; percentage: number; contributions: Contribution[] };
type Department = { id: string; name: string };

export default function OrgGoalsTab({ departments }: { departments: Department[] }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msg, setMsg] = useState({ text: "", ok: true });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalTarget, setTotalTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<{ departmentId: string; target: string; sourceType: string }[]>([{ departmentId: "", target: "", sourceType: "MANUAL" }]);

  useEffect(() => { fetchGoals(); }, []);

  async function fetchGoals() {
    setLoading(true);
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(data.goals || []);
    setLoading(false);
  }

  function addRow() { setRows([...rows, { departmentId: "", target: "", sourceType: "MANUAL" }]); }
  function updateRow(i: number, field: string, value: string) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function removeRow(i: number) { setRows(rows.filter((_, idx) => idx !== i)); }

  async function handleCreate() {
    const contributions = rows.filter(r => r.departmentId && r.target);
    if (!title || !totalTarget || !unit || contributions.length === 0) {
      setMsg({ text: "Fill in the goal details and at least one contributing department.", ok: false });
      return;
    }
    const res = await fetch("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, totalTarget, unit, year, startDate, endDate, contributions }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ text: "Goal created.", ok: true });
      setShowForm(false);
      setTitle(""); setDescription(""); setTotalTarget(""); setUnit(""); setStartDate(""); setEndDate("");
      setRows([{ departmentId: "", target: "", sourceType: "MANUAL" }]);
      fetchGoals();
    } else {
      setMsg({ text: data.error || "Failed to create goal.", ok: false });
    }
  }

  const inp: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "var(--text-primary)", boxSizing: "border-box", marginBottom: 12 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Big organisation-wide targets, fed by multiple departments' contributions.
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 600, cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ New Goal"}
        </button>
      </div>

      {msg.text && <div style={{ color: msg.ok ? "#4ade80" : "#f87171", marginBottom: 16 }}>{msg.text}</div>}

      {showForm && (
        <div className="card-bg" style={{ borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <input style={inp} placeholder="Goal title — e.g. Generate ₦100B in 2026" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea style={{ ...inp, resize: "none", minHeight: 60 } as any} placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <input style={inp} type="number" placeholder="Total target" value={totalTarget} onChange={e => setTotalTarget(e.target.value)} />
            <input style={inp} placeholder="Unit — ₦, enforcements, outreach events..." value={unit} onChange={e => setUnit(e.target.value)} />
            <input style={inp} type="number" placeholder="Year" value={year} onChange={e => setYear(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input style={inp} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <input style={inp} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", margin: "16px 0 10px" }}>Contributing departments</div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
              <select style={{ ...inp, marginBottom: 0 }} value={row.departmentId} onChange={e => updateRow(i, "departmentId", e.target.value)}>
                <option value="">Select department...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input style={{ ...inp, marginBottom: 0 }} type="number" placeholder="Their target" value={row.target} onChange={e => updateRow(i, "target", e.target.value)} />
              <select style={{ ...inp, marginBottom: 0 }} value={row.sourceType} onChange={e => updateRow(i, "sourceType", e.target.value)}>
                <option value="MANUAL">Manual entry</option>
                <option value="AUTO_REVENUE">Auto from revenue</option>
              </select>
              <button onClick={() => removeRow(i)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
          ))}
          <button onClick={addRow} style={{ fontSize: 13, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>+ Add another department</button>

          <button onClick={handleCreate} style={{ padding: "11px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 600, cursor: "pointer" }}>Create goal</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading...</div>
      ) : goals.length === 0 ? (
        <div className="card-bg" style={{ borderRadius: 14, padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          No organisational goals yet. Create one to track a big target across multiple departments.
        </div>
      ) : (
        goals.map((g) => (
          <div key={g.id} className="card-bg" style={{ borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{g.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{g.year} · {g.contributions.length} departments contributing</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: g.percentage >= 90 ? "#4ade80" : g.percentage >= 60 ? "#f59e0b" : "#f87171" }}>{g.percentage}%</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{g.totalCurrent.toLocaleString()} / {g.totalTarget.toLocaleString()} {g.unit}</div>
              </div>
            </div>
            <div style={{ height: 12, background: "var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${Math.min(g.percentage, 100)}%`, background: g.percentage >= 90 ? "#22c55e" : g.percentage >= 60 ? "#f59e0b" : "#ef4444" }} />
            </div>
            <button onClick={() => setExpandedId(expandedId === g.id ? null : g.id)} style={{ fontSize: 13, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>
              {expandedId === g.id ? "Hide breakdown ▲" : "Show department breakdown ▼"}
            </button>
            {expandedId === g.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--border-soft)" }}>
                {g.contributions.map((c) => {
                  const pct = c.target > 0 ? Math.round((c.current / c.target) * 100) : 0;
                  return (
                    <div key={c.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{c.department.name}{c.sourceType === "AUTO_REVENUE" && <span style={{ marginLeft: 6, fontSize: 11, color: "#4ade80" }}>⚡ Auto</span>}</span>
                        <span style={{ color: "var(--text-muted)" }}>{c.current.toLocaleString()} / {c.target.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: "#60a5fa" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}