// src/components/logging/ProxyLog.tsx
//
// Lets a supervisor (or unit secretary) log work on behalf of a staff
// member who can't or won't use the system directly — field enforcement
// with no signal, older staff uncomfortable with forms, etc. The entry is
// tagged so the real staff member can confirm or dispute it later.
//
// REQUIRES a backend change — see the note below the component.

"use client";

import { useState } from "react";
import SearchableStaffPicker from "@/components/SearchableStaffPicker";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";

type StaffOption = { id: string; name: string };

export default function ProxyLog({ onSubmitted }: { onSubmitted: () => void }) {
  const [staffId, setStaffId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  async function submit() {
    setError("");
    if (!staffId) { setError(MESSAGES.proxy.needStaff); return; }
    if (!title.trim() || !category.trim()) { setError(MESSAGES.proxy.needFields); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: title,
          taskCategory: category,
          description: description || title,
          timeSpent: hours,
          priority: "MEDIUM",
          status: "SUBMITTED",
          onBehalfOfUserId: staffId,
          loggedByProxy: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || MESSAGES.generic.serverError); return; }
      showToast(MESSAGES.proxy.success);
      setTitle(""); setCategory(""); setDescription(""); setHours("1"); setStaffId("");
      onSubmitted();
    } catch {
      setError(MESSAGES.generic.networkError);
    } finally {
      setSubmitting(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)", border: "0.5px solid var(--border)",
    borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Log on behalf of staff</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        For staff who can't log this themselves right now. They'll be able to confirm or dispute it later.
      </div>
      {error && <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Staff member *</label>
      <div style={{ marginBottom: 12 }}>
        <SearchableStaffPicker
          onSelect={(staff) => setStaffId(staff ? staff.id : "")}
          placeholder="Search by name, email, or staff ID..."
          restrictToSupervised
        />
      </div>

      <input style={{ ...inp, marginBottom: 10 }} placeholder="Task title *" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input style={{ ...inp, marginBottom: 10 }} placeholder="Category *" value={category} onChange={(e) => setCategory(e.target.value)} />
      <textarea style={{ ...inp, resize: "none", marginBottom: 10 }} rows={2} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <input type="number" step="0.5" min="0.5" max="12" style={{ ...inp, width: 100 }} value={hours} onChange={(e) => setHours(e.target.value)} />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>hours</span>
      </div>

      <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: 13, borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontWeight: 700, cursor: "pointer" }}>
        {submitting ? "Saving…" : "Log for this staff member"}
      </button>
    </div>
  );
}

/*
  BACKEND NOTE — required change to /api/daily-logs POST handler:

  1. Read `onBehalfOfUserId` and `loggedByProxy` from the request body.
  2. If `onBehalfOfUserId` is present:
     a. Verify the SESSION user is actually the supervisor of that target
        user (check `targetUser.supervisorId === session.user.id`, or that
        session user's role is HOD/HR/DIRECTOR for that department) —
        never trust the client to self-report this.
     b. Save the DailyLog with `userId: onBehalfOfUserId` (not the session
        user), plus a `loggedByProxy: true` flag and `proxyLoggedById: session.user.id`.
  3. Otherwise, behave exactly as it does today (userId = session user).

  This also needs two schema fields I didn't include in the earlier diff —
  add these to DailyLog:
    loggedByProxy    Boolean @default(false)
    proxyLoggedById  String?
*/