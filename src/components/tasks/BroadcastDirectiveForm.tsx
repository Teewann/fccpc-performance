// src/components/tasks/BroadcastDirectiveForm.tsx
//
// Drop-in modal/section for tasks/page.tsx. Doesn't touch your existing
// create-task form — this is a separate action for Director/Admin/
// Executive/HR to push one directive to an entire department at once.
//
// Usage in tasks/page.tsx:
//   import BroadcastDirectiveForm from "@/components/tasks/BroadcastDirectiveForm";
//   const [showBroadcast, setShowBroadcast] = useState(false);
//   ...
//   {canAssign && (
//     <button onClick={() => setShowBroadcast(true)}>📣 Broadcast to department</button>
//   )}
//   {showBroadcast && (
//     <BroadcastDirectiveForm
//       departments={departments}      // you already fetch this elsewhere
//       defaultDepartmentId={userDeptId}
//       onClose={() => setShowBroadcast(false)}
//       onSuccess={() => { setShowBroadcast(false); fetchTasks(); }}
//     />
//   )}

"use client";

import { useState, useRef } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type Department = { id: string; name: string };

export default function BroadcastDirectiveForm({
  departments,
  defaultDepartmentId,
  onClose,
  onSuccess,
}: {
  departments: Department[];
  defaultDepartmentId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId || "");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box", marginBottom: 14,
  };
  const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 };

  async function submit() {
    setError("");
    if (!title.trim() || !description.trim() || !departmentId) {
      setError("Title, description, and department are required.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", description);
      fd.append("departmentId", departmentId);
      fd.append("priority", priority);
      if (dueDate) fd.append("dueDate", dueDate);
      if (file) fd.append("document", file);

      const res = await fetch("/api/tasks/broadcast", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Broadcast failed.");
        return;
      }
      showToast(`Sent to ${data.spawnedCount} staff members.`);
      if (fileRef.current) fileRef.current.value = "";
      onSuccess();
    } catch {
      setError("Connection issue — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Broadcast to department</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
          Every active staff member in the selected department gets their own copy of this directive,
          tracked and completed individually.
        </p>

        {error && (
          <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <label style={lbl}>Directive title *</label>
        <input style={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 compliance file review" />

        <label style={lbl}>Description *</label>
        <textarea style={{ ...inp, resize: "none", minHeight: 90 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does every staff member need to do?" />

        <label style={lbl}>Department *</label>
        <select style={inp} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Select department…</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Priority</label>
            <select style={inp} value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Due date</label>
            <input type="date" style={inp} value={dueDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <label style={lbl}>Attach document (optional)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ ...inp, padding: "10px 14px" }}
        />
        {file && (
          <div style={{ fontSize: 12, color: "#4ade80", marginTop: -10, marginBottom: 14 }}>
            📎 {file.name} — every staff member in this broadcast gets a copy on their own task
          </div>
        )}

        <div style={{ display: "flex", gap: 12, paddingTop: 8 }}>
          <button onClick={onClose} style={{ padding: "11px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={submitting} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
            {submitting ? "Sending…" : "Send to department"}
          </button>
        </div>
      </div>
    </div>
  );
}