// src/components/QuickCaptureLog.tsx
//
// Drop this into your check-in page as an alternate entry mode. It lets
// staff paste one rough paragraph describing everything they did, sends it
// to /api/daily-logs/quick-capture for AI parsing, shows the results as
// editable draft cards, and submits each confirmed draft to your EXISTING
// POST /api/daily-logs endpoint — so the real save path doesn't change at all.
//
// Usage in check-in/page.tsx:
//   import QuickCaptureLog from "@/components/QuickCaptureLog";
//   ...
//   const [mode, setMode] = useState<"quick" | "manual">("quick");
//   {mode === "quick"
//     ? <QuickCaptureLog onSubmitted={fetchTodayLogs} onSwitchToManual={() => setMode("manual")} />
//     : /* your existing form, with a button to setMode("quick") */}

"use client";

import { useState } from "react";
import { getTaskTypeLabel, getTaskTypeIcon } from "@/config/taskTypes";
import { useToast } from "@/components/ui/ToastProvider";
import { MESSAGES } from "@/lib/messages";
import DurationPicker from "@/components/DurationPicker";
type Draft = {
  title: string;
  taskCategory: string;
  taskType: string;
  description: string;
  timeSpent: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  crossDepartment: string | null;
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#4ade80",
  MEDIUM: "#60a5fa",
  HIGH: "#f59e0b",
  CRITICAL: "#f87171",
};

export default function QuickCaptureLog({
  onSubmitted,
  onSwitchToManual,
}: {
  onSubmitted: () => void;
  onSwitchToManual: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const inp: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-input)",
    border: "0.5px solid var(--border)",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
  };

  async function handleParse() {
    setError("");
    if (rawText.trim().length < 3) {
      setError(MESSAGES.quickCapture.tooShort);
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/daily-logs/quick-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error || MESSAGES.quickCapture.parseError);
          return;
        }
        setError(data.error || MESSAGES.quickCapture.parseError);
        return;
      }
      setDrafts(data.drafts);
      showToast(MESSAGES.quickCapture.parseSuccess(data.drafts.length));
    } catch {
      setError(MESSAGES.generic.networkError);
    } finally {
      setParsing(false);
    }
  }

  function updateDraft(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function removeDraft(i: number) {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmitAll() {
    setSubmitting(true);
    setError("");
    let ok = 0;
    for (const d of drafts) {
      try {
        const res = await fetch("/api/daily-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: d.title,
            taskCategory: d.taskCategory,
            taskType: d.taskType,
            description: d.description,
            timeSpent: String(d.timeSpent),
            priority: d.priority,
            status: "SUBMITTED",
            caseReference: "",
            amountInvolved: "",
            notes: d.crossDepartment
              ? `Cross-department: work for/with ${d.crossDepartment} (flagged for acknowledgment)`
              : "",
          }),
        });
        if (res.ok) ok++;
      } catch {
        // keep going, report partial success below
      }
    }
    setSubmitting(false);
    if (ok === drafts.length) {
      showToast(MESSAGES.quickCapture.submitAllSuccess(ok));
      setDrafts([]);
      setRawText("");
      onSubmitted();
    } else {
      setError(MESSAGES.quickCapture.submitPartial(ok, drafts.length));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Quick capture</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Describe everything you did today in your own words. AI will split it into entries.
          </div>
        </div>
        <button
          onClick={onSwitchToManual}
          style={{ padding: "8px 14px", borderRadius: 9, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}
        >
          Use manual form instead
        </button>
      </div>

      {error && (
        <div style={{ background: "#1f0707", border: "0.5px solid #7f1d1d", color: "#f87171", borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {drafts.length === 0 && (
        <>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={5}
            placeholder={`e.g. "Fixed the printer for Finance around 9am, went to CBE market for sensitization outreach 11 to 1, reviewed three consumer complaints, called Mrs Adaeze back about her refund"`}
            style={{ ...inp, resize: "none" } as any}
          />
          <button
            onClick={handleParse}
            disabled={parsing}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              border: "1.5px solid #22c55e",
              background: "#052e16",
              color: "#4ade80",
              fontSize: 14,
              fontWeight: 700,
              cursor: parsing ? "not-allowed" : "pointer",
              opacity: parsing ? 0.6 : 1,
            }}
          >
            {parsing ? "Reading through what you wrote…" : "Split into log entries"}
          </button>
        </>
      )}

      {drafts.length > 0 && (
        <>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
            Found {drafts.length} {drafts.length === 1 ? "entry" : "entries"}. Review and edit before submitting.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {drafts.map((d, i) => (
              <div key={i} className="card-bg" style={{ borderRadius: 12, padding: 16, border: "0.5px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <input
                    value={d.title}
                    onChange={(e) => updateDraft(i, { title: e.target.value })}
                    style={{ ...inp, fontWeight: 600, flex: 1 }}
                  />
                  <button
                    onClick={() => removeDraft(i)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: "0 6px" }}
                    aria-label="Remove entry"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={d.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                  rows={2}
                  style={{ ...inp, resize: "none", marginBottom: 10, fontSize: 13 } as any}
                />
                {d.crossDepartment && (
                                    <div style={{ fontSize: 12, color: "#f59e0b", background: "#1c1107", border: "0.5px solid #78350f", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                    Flagged as cross-department work with <strong>{d.crossDepartment}</strong>. Will need their acknowledgment once that flow is live.
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <DurationPicker
                    onChange={(hours) => updateDraft(i, { timeSpent: hours })}
                    initialHours={d.timeSpent}
                  />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--text-hint)" }}>
                    {getTaskTypeIcon(d.taskType)} {getTaskTypeLabel(d.taskType)}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 7,
                      color: PRIORITY_COLOR[d.priority],
                      background: `${PRIORITY_COLOR[d.priority]}22`,
                      border: `0.5px solid ${PRIORITY_COLOR[d.priority]}44`,
                    }}
                  >
                    {d.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setDrafts([])}
              style={{ padding: "12px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", cursor: "pointer" }}
            >
              Start over
            </button>
            <button
              onClick={handleSubmitAll}
              disabled={submitting || drafts.length === 0}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 10,
                border: "1.5px solid #22c55e",
                background: "#052e16",
                color: "#4ade80",
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting…" : `Submit all ${drafts.length} entries`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}