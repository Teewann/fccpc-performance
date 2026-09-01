// src/components/PendingAcknowledgments.tsx
//
// Drop this into the sidebar of daily-log/page.tsx (next to "Today's
// submitted logs"). Only fetches when mounted, only returns what's
// relevant to this specific user — no system-wide query.

"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";

type ProxyItem = {
  id: string;
  taskTitle: string;
  description: string;
  timeSpent: number;
  createdAt: string;
  proxyLoggedBy: { name: string } | null;
};

type CrossDeptItem = {
  id: string;
  taskTitle: string;
  description: string;
  crossDeptFlag: string | null;
  createdAt: string;
  user: { name: string };
};

export default function PendingAcknowledgments() {
  const [proxyPending, setProxyPending] = useState<ProxyItem[]>([]);
  const [crossDeptPending, setCrossDeptPending] = useState<CrossDeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-logs/pending-actions");
      const data = await res.json();
      setProxyPending(data.proxyPending || []);
      setCrossDeptPending(data.crossDeptPending || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "CONFIRM" | "DISPUTE") {
    setActingOn(id);
    try {
      const res = await fetch(`/api/daily-logs/${id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(action === "CONFIRM" ? MESSAGES.acknowledge.confirmed : MESSAGES.acknowledge.disputed);
        load();
      } else {
        showToast(data.error || MESSAGES.generic.serverError, false);
      }
    } catch {
      showToast(MESSAGES.generic.networkError, false);
    } finally {
      setActingOn(null);
    }
  }

  const total = proxyPending.length + crossDeptPending.length;
  if (!loading && total === 0) return null; // nothing waiting — don't clutter the page

  return (
    <div className="card-bg" style={{ borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14, paddingBottom: 10, borderBottom: "0.5px solid var(--border-soft)" }}>
        Needs your confirmation {total > 0 && `(${total})`}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>Checking…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {proxyPending.map((item) => (
            <div key={item.id} style={{ padding: "12px 14px", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                {item.proxyLoggedBy?.name || "Someone"} logged this on your behalf:
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{item.taskTitle}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>{item.description}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => act(item.id, "CONFIRM")} disabled={actingOn === item.id}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✓ Confirm
                </button>
                <button onClick={() => act(item.id, "DISPUTE")} disabled={actingOn === item.id}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✕ Dispute
                </button>
              </div>
            </div>
          ))}

          {crossDeptPending.map((item) => (
            <div key={item.id} style={{ padding: "12px 14px", background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                {item.user.name} says they did this involving your department:
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{item.taskTitle}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>{item.description}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => act(item.id, "CONFIRM")} disabled={actingOn === item.id}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✓ Confirm
                </button>
                <button onClick={() => act(item.id, "DISPUTE")} disabled={actingOn === item.id}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "0.5px solid #7f1d1d", background: "#1f0707", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✕ Dispute
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}