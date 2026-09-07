"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";
import { useToast } from "@/components/ui/ToastProvider";

type Transfer = {
  id: string;
  caseRef: string;
  caseTitle: string;
  caseType: string;
  description: string;
  fromOffice: string;
  toOffice: string;
  transferType: string;
  priority: string;
  status: string;
  transferNote: string;
  rejectedReason: string | null;
  completedNote: string | null;
  dueDate: string | null;
  createdAt: string;
  initiatedBy: { id: string; name: string; department: { name: string } | null };
  acceptedBy: { id: string; name: string } | null;
  targetUser: { id: string; name: string } | null;
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  PENDING_ACCEPTANCE: { bg: "#0c1a2e", color: "#60a5fa", border: "#1e3a5f", label: "Pending acceptance", icon: "⏳" },
  ACCEPTED: { bg: "#1a0a2e", color: "#a78bfa", border: "#4c1d95", label: "Accepted", icon: "👁" },
  IN_PROGRESS: { bg: "#1c1107", color: "#f59e0b", border: "#78350f", label: "In progress", icon: "⚙️" },
  COMPLETED: { bg: "#052e16", color: "#4ade80", border: "#14532d", label: "Completed", icon: "✅" },
  REJECTED: { bg: "#1f0707", color: "#f87171", border: "#7f1d1d", label: "Rejected", icon: "✕" },
  RECALLED: { bg: "#1a1d28", color: "#6b7280", border: "#374151", label: "Recalled", icon: "↩" },
};

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  ZONE_TO_ZONE: "Zone to zone",
  ZONE_TO_HQ: "Zone to HQ",
  HQ_TO_ZONE: "HQ to zone",
  INTERSTATE: "Interstate",
  INTER_DEPARTMENTAL: "Inter-departmental",
};

const PRIORITY_COLOR: Record<string, string> = { LOW: "#4ade80", MEDIUM: "#60a5fa", HIGH: "#f59e0b", CRITICAL: "#f87171" };

const EMPTY_FORM = {
  caseRef: "", caseTitle: "", caseType: "", description: "",
  fromOffice: "", toOffice: "", transferType: "ZONE_TO_ZONE",
  priority: "MEDIUM", transferNote: "", dueDate: "",
};

export default function CaseTransferPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [counts, setCounts] = useState({ total: 0, pendingAcceptance: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"all" | "initiated" | "incoming">("all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [completeNote, setCompleteNote] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/case-transfer?${params}`);
      const data = await res.json();
      setTransfers(data.transfers || []);
      setCounts(data.counts || { total: 0, pendingAcceptance: 0, inProgress: 0, completed: 0 });
    } finally {
      setLoading(false);
    }
  }, [view, statusFilter]);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/case-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Transfer ${data.transfer.caseRef} initiated.`);
        setForm(EMPTY_FORM);
        setShowForm(false);
        fetchTransfers();
      } else {
        showToast(data.error || "Something went wrong on our end. Try again shortly.", false);
      }
    } catch {
      showToast("Connection issue — try again in a moment.", false);
    } finally {
      setSubmitting(false);
    }
  }

  async function patch(body: object) {
    const res = await fetch("/api/case-transfer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  async function act(action: string, extra: object = {}) {
    if (!selected) return;
    setSubmitting(true);
    const { ok, data } = await patch({ transferId: selected.id, action, ...extra });
    setSubmitting(false);
    if (ok) {
      showToast(`Transfer ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : action === "complete" ? "marked complete" : action === "recall" ? "recalled" : "updated"}.`);
      setSelected(null);
      setShowRejectBox(false);
      setRejectReason("");
      setCompleteNote("");
      fetchTransfers();
    } else {
      showToast(data.error || "Something went wrong on our end. Try again shortly.", false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box", marginBottom: 14,
  };
  const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 };

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Case Transfers</h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>{today}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowForm(true)} style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              + New transfer
            </button>
            <ThemeToggleButton />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { key: "all", label: "All" },
            { key: "incoming", label: "Incoming" },
            { key: "initiated", label: "Initiated by me" },
          ].map((v) => (
            <button key={v.key} onClick={() => setView(v.key as any)}
              style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${view === v.key ? "#60a5fa" : "var(--border)"}`,
                background: view === v.key ? "#0c1a2e" : "var(--bg-input)",
                color: view === v.key ? "#60a5fa" : "var(--text-muted)" }}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total", value: counts.total, color: "var(--text-primary)" },
            { label: "Pending acceptance", value: counts.pendingAcceptance, color: "#60a5fa" },
            { label: "In progress", value: counts.inProgress, color: "#f59e0b" },
            { label: "Completed", value: counts.completed, color: "#4ade80" },
          ].map((s) => (
            <div key={s.label} className="card-bg" style={{ borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="card-bg" style={{ borderRadius: 14, padding: 26, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Initiate transfer</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div><label style={lbl}>Case reference *</label><input style={inp} value={form.caseRef} onChange={(e) => setForm({ ...form, caseRef: e.target.value })} placeholder="e.g. S&I-2026-0142" required /></div>
                <div><label style={lbl}>Case type *</label><input style={inp} value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })} placeholder="e.g. Consumer complaint" required /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Case title *</label><input style={inp} value={form.caseTitle} onChange={(e) => setForm({ ...form, caseTitle: e.target.value })} required /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Description *</label><textarea style={{ ...inp, resize: "none", minHeight: 80 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
                <div><label style={lbl}>From office *</label><input style={inp} value={form.fromOffice} onChange={(e) => setForm({ ...form, fromOffice: e.target.value })} required /></div>
                <div><label style={lbl}>To office *</label><input style={inp} value={form.toOffice} onChange={(e) => setForm({ ...form, toOffice: e.target.value })} required /></div>
                <div>
                  <label style={lbl}>Transfer type *</label>
                  <select style={inp} value={form.transferType} onChange={(e) => setForm({ ...form, transferType: e.target.value })}>
                    {Object.entries(TRANSFER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Transfer note *</label><textarea style={{ ...inp, resize: "none", minHeight: 70 }} value={form.transferNote} onChange={(e) => setForm({ ...form, transferNote: e.target.value })} placeholder="Why is this being transferred?" required /></div>
                <div><label style={lbl}>Due date</label><input type="date" style={inp} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {submitting ? "Sending…" : "Initiate transfer"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>Loading…</div>
            ) : transfers.length === 0 ? (
              <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)" }}>No transfers here</div>
              </div>
            ) : (
              transfers.map((t) => {
                const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.PENDING_ACCEPTANCE;
                const pc = PRIORITY_COLOR[t.priority] || "#60a5fa";
                const sel = selected?.id === t.id;
                return (
                  <div key={t.id} onClick={() => { setSelected(sel ? null : t); setShowRejectBox(false); }} className="card-bg"
                    style={{ borderRadius: 14, padding: "18px 22px", cursor: "pointer", borderLeft: `3px solid ${sel ? "var(--accent)" : sc.color}`, outline: `0.5px solid ${sel ? "var(--accent)" : "var(--border)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{t.caseTitle}</div>
                        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#f59e0b" }}>{t.caseRef}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, color: pc, background: `${pc}22`, border: `0.5px solid ${pc}44` }}>{t.priority}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: sc.bg, color: sc.color, border: `0.5px solid ${sc.border}` }}>{sc.icon} {sc.label}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {t.fromOffice} → {t.toOffice} · {TRANSFER_TYPE_LABELS[t.transferType]} · By {t.initiatedBy.name}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selected && (
            <div className="card-bg" style={{ borderRadius: 14, padding: 24, position: "sticky", top: 24, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{selected.caseTitle}</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ fontSize: 13, color: "#f59e0b", fontFamily: "monospace", marginBottom: 14 }}>{selected.caseRef}</div>

              <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{selected.description}</div>
              </div>

              {[
                { label: "From → To", value: `${selected.fromOffice} → ${selected.toOffice}` },
                { label: "Transfer type", value: TRANSFER_TYPE_LABELS[selected.transferType] },
                { label: "Initiated by", value: selected.initiatedBy.name },
                ...(selected.acceptedBy ? [{ label: "Accepted by", value: selected.acceptedBy.name }] : []),
                { label: "Transfer note", value: selected.transferNote },
                ...(selected.rejectedReason ? [{ label: "Rejection reason", value: selected.rejectedReason }] : []),
                ...(selected.completedNote ? [{ label: "Completion note", value: selected.completedNote }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{value}</div>
                </div>
              ))}

              {selected.status === "PENDING_ACCEPTANCE" && (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={() => act("accept")} disabled={submitting} style={{ flex: 1, padding: 11, borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>Accept</button>
                  <button onClick={() => setShowRejectBox(true)} disabled={submitting} style={{ flex: 1, padding: 11, borderRadius: 9, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontWeight: 600, cursor: "pointer" }}>Reject</button>
                </div>
              )}

              {showRejectBox && (
                <div style={{ marginTop: 12 }}>
                  <textarea style={{ ...inp, resize: "none" }} rows={2} placeholder="Reason for rejecting" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  <button onClick={() => act("reject", { rejectedReason: rejectReason })} disabled={!rejectReason.trim() || submitting}
                    style={{ width: "100%", padding: 11, borderRadius: 9, border: "1.5px solid #f87171", background: "#1f0707", color: "#f87171", fontWeight: 700, cursor: "pointer" }}>
                    Confirm rejection
                  </button>
                </div>
              )}

              {selected.status === "ACCEPTED" && (
                <button onClick={() => act("start")} disabled={submitting} style={{ width: "100%", marginTop: 16, padding: 11, borderRadius: 9, border: "1.5px solid #f59e0b", background: "#1c1107", color: "#f59e0b", fontWeight: 700, cursor: "pointer" }}>
                  Start progress
                </button>
              )}

              {["ACCEPTED", "IN_PROGRESS"].includes(selected.status) && (
                <div style={{ marginTop: 12 }}>
                  <textarea style={{ ...inp, resize: "none" }} rows={2} placeholder="Completion note (optional)" value={completeNote} onChange={(e) => setCompleteNote(e.target.value)} />
                  <button onClick={() => act("complete", { completedNote: completeNote })} disabled={submitting}
                    style={{ width: "100%", padding: 11, borderRadius: 9, border: "1.5px solid #4ade80", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
                    Mark complete
                  </button>
                </div>
              )}

              {selected.status === "PENDING_ACCEPTANCE" && (
                <button onClick={() => act("recall")} disabled={submitting} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}>
                  Recall transfer
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
