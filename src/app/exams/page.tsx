"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

type Exam = {
  id: string;
  title: string;
  description: string | null;
  targetRole: string;
  gradeLevel: string | null;
  duration: number;
  passMark: number;
  isActive: boolean;
  _count: { questions: number; attempts: number };
  attempts: {
    id: string;
    score: number;
    percentage: number;
    passed: boolean;
    completedAt: string | null;
  }[];
};

type View = "list" | "take" | "result" | "create";

type Question = {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
  order: number;
};

type ExamForTaking = {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  passMark: number;
  questions: Question[];
};

type Result = {
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  passMark: number;
  breakdown: { questionId: string; correct: boolean; selected: string; correctAnswer: string }[];
};

const ROLES = ["STAFF", "SUPERVISOR", "DIRECTOR", "HR", "EXECUTIVE"];

const EMPTY_QUESTION = { text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", marks: 1 };

export default function ExamsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role || "";
  const isPrivileged = ["ADMIN", "HR", "EXECUTIVE"].includes(role);

  const [view,       setView]       = useState<View>("list");
  const [exams,      setExams]      = useState<Exam[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState({ text: "", ok: true });

  // Taking exam
  const [activeExam, setActiveExam]   = useState<ExamForTaking | null>(null);
  const [answers,    setAnswers]       = useState<Record<string, string>>({});
  const [timeLeft,   setTimeLeft]      = useState(0);
  const [currentQ,   setCurrentQ]      = useState(0);
  const [result,     setResult]        = useState<Result | null>(null);

  // Create exam form
  const [createForm, setCreateForm] = useState({
    title: "", description: "", targetRole: "STAFF",
    gradeLevel: "", duration: "60", passMark: "60",
  });
  const [questions, setQuestions] = useState([{ ...EMPTY_QUESTION }]);

  useEffect(() => { fetchExams(); }, []);

  // Countdown timer
  useEffect(() => {
    if (view !== "take" || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(t); handleSubmitExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [view, timeLeft]);

  async function fetchExams() {
    setLoading(true);
    try {
      const res  = await fetch("/api/exams");
      const data = await res.json();
      setExams(data.exams || []);
    } finally { setLoading(false); }
  }

  async function handleStartExam(examId: string) {
    setMsg({ text: "", ok: true });
    try {
      const res  = await fetch(`/api/exam-attempt?examId=${examId}`);
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Cannot start exam."); return; }
      setActiveExam(data.exam);
      setAnswers({});
      setCurrentQ(0);
      setTimeLeft(data.exam.duration * 60);
      setView("take");
    } catch { alert("Failed to load exam."); }
  }

  async function handleSubmitExam() {
    if (!activeExam) return;
    setSubmitting(true);
    try {
      const res  = await fetch("/api/exam-attempt", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ examId: activeExam.id, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.result);
        setView("result");
        fetchExams();
      } else { alert(data.error || "Submission failed."); }
    } finally { setSubmitting(false); }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg({ text: "", ok: true });
    try {
      const res  = await fetch("/api/exams", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...createForm, questions }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: "Exam created successfully.", ok: true });
        setCreateForm({ title: "", description: "", targetRole: "STAFF", gradeLevel: "", duration: "60", passMark: "60" });
        setQuestions([{ ...EMPTY_QUESTION }]);
        setView("list");
        fetchExams();
      } else { setMsg({ text: data.error || "Failed to create exam.", ok: false }); }
    } finally { setSubmitting(false); }
  }

  async function toggleActive(examId: string, isActive: boolean) {
    await fetch("/api/exams", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ examId, isActive }),
    });
    fetchExams();
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { ...EMPTY_QUESTION }]);
  }

  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: string, value: string | number) {
    setQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-input)",
    border: "0.5px solid var(--border)", borderRadius: 10,
    padding: "12px 14px", fontSize: 15, color: "var(--text-primary)",
    outline: "none", boxSizing: "border-box", marginBottom: 14,
  };

  const lbl: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "var(--text-muted)", marginBottom: 7,
  };

  // ── TAKING EXAM VIEW ─────────────────────────────────────────────────
  if (view === "take" && activeExam) {
    const q         = activeExam.questions[currentQ];
    const answered  = Object.keys(answers).length;
    const total     = activeExam.questions.length;
    const progress  = Math.round((answered / total) * 100);
    const isLow     = timeLeft < 120;

    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
        <main className="flex-1 p-6" style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Exam header */}
          <div className="card-bg" style={{ borderRadius: 14, padding: "16px 22px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{activeExam.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                Question {currentQ + 1} of {total} · {answered} answered
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: isLow ? "#f87171" : "#4ade80", letterSpacing: "-0.02em" }}>
                {formatTime(timeLeft)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-hint)", fontWeight: 500 }}>TIME LEFT</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#22c55e", borderRadius: 2, transition: "width 0.3s" }} />
          </div>

          {/* Question card */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 28, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Question {currentQ + 1} · {q.marks} {q.marks === 1 ? "mark" : "marks"}
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 24 }}>
              {q.text}
            </div>

            {/* Options */}
            {(["A", "B", "C", "D"] as const).map((opt) => {
              const value    = q[`option${opt}` as keyof Question] as string;
              const selected = answers[q.id] === opt;
              return (
                <div
                  key={opt}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "14px 16px", borderRadius: 10, marginBottom: 10,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${selected ? "#22c55e" : "var(--border)"}`,
                    background: selected ? "#052e16" : "var(--bg-input)",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    border: `1.5px solid ${selected ? "#22c55e" : "var(--border)"}`,
                    background: selected ? "#22c55e" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                    color: selected ? "#0a0c12" : "var(--text-muted)",
                  }}>
                    {opt}
                  </div>
                  <div style={{ fontSize: 15, color: selected ? "#4ade80" : "var(--text-primary)", lineHeight: 1.5, paddingTop: 3 }}>
                    {value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
              disabled={currentQ === 0}
              style={{ padding: "11px 22px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: currentQ === 0 ? "not-allowed" : "pointer", opacity: currentQ === 0 ? 0.5 : 1 }}
            >
              ← Previous
            </button>

            {/* Question dots */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {activeExam.questions.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  style={{
                    width: 10, height: 10, borderRadius: "50%", cursor: "pointer",
                    background: i === currentQ ? "#22c55e" : answers[activeExam.questions[i].id] ? "#22c55e88" : "var(--border)",
                    border: i === currentQ ? "none" : "0.5px solid var(--border)",
                  }}
                />
              ))}
            </div>

            {currentQ < total - 1 ? (
              <button
                onClick={() => setCurrentQ((p) => Math.min(total - 1, p + 1))}
                style={{ padding: "11px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                style={{ padding: "11px 24px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Submitting..." : `Submit exam (${answered}/${total} answered)`}
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── RESULT VIEW ──────────────────────────────────────────────────────
  if (view === "result" && result) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
        <Sidebar />
        <main className="flex-1 p-6 min-w-0" style={{ maxWidth: 700 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)" }}>Exam Result</h1>
            <ThemeToggleButton />
          </div>

          {/* Score card */}
          <div className="card-bg" style={{ borderRadius: 16, padding: 32, textAlign: "center", marginBottom: 20, borderTop: `4px solid ${result.passed ? "#22c55e" : "#ef4444"}` }}>
            <div style={{ fontSize: 20, marginBottom: 16 }}>{result.passed ? "🎉" : "📚"}</div>
            <div style={{ fontSize: 72, fontWeight: 700, color: result.passed ? "#4ade80" : "#f87171", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {result.percentage}%
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginTop: 12 }}>
              {result.passed ? "Congratulations — You passed!" : "Keep studying — You did not pass"}
            </div>
            <div style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 8 }}>
              Score: {result.score} / {result.totalMarks} marks · Pass mark: {result.passMark}%
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden", marginTop: 20, maxWidth: 300, margin: "20px auto 0" }}>
              <div style={{ height: "100%", borderRadius: 4, width: `${result.percentage}%`, background: result.passed ? "#22c55e" : "#ef4444" }} />
            </div>
          </div>

          {/* Question breakdown */}
          <div className="card-bg" style={{ borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, paddingBottom: 12, borderBottom: "0.5px solid var(--border-soft)" }}>
              Answer breakdown
            </h2>
            {result.breakdown.map((item, i) => (
              <div key={item.questionId} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "0.5px solid var(--border-soft)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: item.correct ? "#052e16" : "#1f0707", color: item.correct ? "#4ade80" : "#f87171", border: `0.5px solid ${item.correct ? "#14532d" : "#7f1d1d"}` }}>
                  {item.correct ? "✓" : "✗"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Question {i + 1}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Your answer: <strong style={{ color: item.correct ? "#4ade80" : "#f87171" }}>{item.selected}</strong>
                  {!item.correct && (
                    <span style={{ marginLeft: 8, color: "#4ade80" }}>Correct: {item.correctAnswer}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setView("list"); setResult(null); setActiveExam(null); }}
            style={{ padding: "12px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Back to exams
          </button>
        </main>
      </div>
    );
  }

  // ── CREATE EXAM VIEW (Admin/HR only) ─────────────────────────────────
  if (view === "create" && isPrivileged) {
    return (
      <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
        <Sidebar />
        <main className="flex-1 p-6 min-w-0">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)" }}>Create Promotion Exam</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Add exam details and questions below</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setView("list")} style={{ padding: "10px 20px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                Cancel
              </button>
              <ThemeToggleButton />
            </div>
          </div>

          {msg.text && (
            <div style={{ background: msg.ok ? "var(--accent-bg)" : "#1f0707", border: `0.5px solid ${msg.ok ? "var(--accent-border)" : "#7f1d1d"}`, color: msg.ok ? "var(--accent-text)" : "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 20 }}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleCreateExam}>
            {/* Exam details */}
            <div className="card-bg" style={{ borderRadius: 14, padding: 26, marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                Exam details
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Exam title *</label>
                  <input style={inp} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="e.g. Promotion Exam — GL-08 to GL-10" required />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={lbl}>Description</label>
                  <textarea style={{ ...inp, resize: "none", minHeight: 70 } as any} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Instructions and overview for candidates..." />
                </div>
                <div>
                  <label style={lbl}>Target role *</label>
                  <select style={inp} value={createForm.targetRole} onChange={(e) => setCreateForm({ ...createForm, targetRole: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Grade level (optional)</label>
                  <input style={inp} value={createForm.gradeLevel} onChange={(e) => setCreateForm({ ...createForm, gradeLevel: e.target.value })} placeholder="e.g. GL-08 to GL-10" />
                </div>
                <div>
                  <label style={lbl}>Duration (minutes) *</label>
                  <input style={inp} type="number" min="10" max="300" value={createForm.duration} onChange={(e) => setCreateForm({ ...createForm, duration: e.target.value })} required />
                </div>
                <div>
                  <label style={lbl}>Pass mark (%) *</label>
                  <input style={inp} type="number" min="1" max="100" value={createForm.passMark} onChange={(e) => setCreateForm({ ...createForm, passMark: e.target.value })} required />
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="card-bg" style={{ borderRadius: 14, padding: 26, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 14, borderBottom: "0.5px solid var(--border-soft)" }}>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                  Questions ({questions.length})
                </h2>
                <button type="button" onClick={addQuestion} style={{ padding: "8px 18px", borderRadius: 9, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + Add question
                </button>
              </div>

              {questions.map((q, i) => (
                <div key={i} style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>Question {i + 1}</div>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(i)} style={{ background: "none", border: "none", color: "#f87171", fontSize: 16, cursor: "pointer" }}>✕</button>
                    )}
                  </div>

                  <label style={lbl}>Question text *</label>
                  <textarea
                    style={{ ...inp, resize: "none", minHeight: 70 } as any}
                    value={q.text}
                    onChange={(e) => updateQuestion(i, "text", e.target.value)}
                    placeholder="Enter the question here..."
                    required
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {(["A", "B", "C", "D"] as const).map((opt) => (
                      <div key={opt}>
                        <label style={{ ...lbl, color: q.correctAnswer === opt ? "var(--accent-text)" : "var(--text-muted)" }}>
                          Option {opt} {q.correctAnswer === opt && "✓ Correct"}
                        </label>
                        <input
                          style={{ ...inp, marginBottom: 0, borderColor: q.correctAnswer === opt ? "var(--accent)" : "var(--border)" }}
                          value={q[`option${opt}` as keyof typeof q] as string}
                          onChange={(e) => updateQuestion(i, `option${opt}`, e.target.value)}
                          placeholder={`Option ${opt}`}
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <div>
                      <label style={lbl}>Correct answer *</label>
                      <select style={{ ...inp, marginBottom: 0 }} value={q.correctAnswer} onChange={(e) => updateQuestion(i, "correctAnswer", e.target.value)}>
                        {["A", "B", "C", "D"].map((o) => <option key={o} value={o}>Option {o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Marks</label>
                      <input style={{ ...inp, marginBottom: 0 }} type="number" min="1" max="10" value={q.marks} onChange={(e) => updateQuestion(i, "marks", parseInt(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={() => setView("list")} style={{ padding: "12px 22px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} style={{ padding: "12px 28px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
                {submitting ? "Creating..." : `Create exam (${questions.length} questions)`}
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  // ── EXAM LIST VIEW ───────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <Sidebar />
      <main className="flex-1 p-6 min-w-0">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Promotion Exams
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              {today} · {isPrivileged ? "Manage and monitor promotion exams" : "Available promotion exams"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {isPrivileged && (
              <button onClick={() => setView("create")} style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                + Create exam
              </button>
            )}
            <ThemeToggleButton />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 15 }}>Loading exams...</div>
        ) : exams.length === 0 ? (
          <div className="card-bg" style={{ borderRadius: 14, padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>📝</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>No exams available</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {isPrivileged ? "Create the first promotion exam using the button above" : "No promotion exams are available at this time"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {exams.map((exam) => {
              const attempt    = exam.attempts[0];
              const hasTaken   = !!attempt?.completedAt;
              const canTake    = exam.isActive && !hasTaken;

              return (
                <div key={exam.id} className="card-bg" style={{ borderRadius: 14, padding: "22px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{exam.title}</div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: exam.isActive ? "#052e16" : "#1a1d28", color: exam.isActive ? "#4ade80" : "#6b7280", border: `0.5px solid ${exam.isActive ? "#14532d" : "#374151"}` }}>
                          {exam.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      {exam.description && (
                        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.5 }}>{exam.description}</div>
                      )}
                      <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-hint)", flexWrap: "wrap" }}>
                        <span>🎯 Target: {exam.targetRole.charAt(0) + exam.targetRole.slice(1).toLowerCase()}</span>
                        {exam.gradeLevel && <span>📊 {exam.gradeLevel}</span>}
                        <span>⏱ {exam.duration} minutes</span>
                        <span>✅ Pass mark: {exam.passMark}%</span>
                        <span>📋 {exam._count.questions} questions</span>
                        {isPrivileged && <span>👥 {exam._count.attempts} attempts</span>}
                      </div>
                    </div>

                    {/* Result or action button */}
                    <div style={{ flexShrink: 0, marginLeft: 20, textAlign: "right" }}>
                      {hasTaken ? (
                        <div>
                          <div style={{ fontSize: 28, fontWeight: 700, color: attempt.passed ? "#4ade80" : "#f87171", letterSpacing: "-0.02em" }}>
                            {attempt.percentage}%
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: attempt.passed ? "#4ade80" : "#f87171" }}>
                            {attempt.passed ? "PASSED" : "FAILED"}
                          </div>
                        </div>
                      ) : canTake ? (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          style={{ padding: "10px 22px", borderRadius: 10, border: "1.5px solid #22c55e", background: "#052e16", color: "#4ade80", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                        >
                          Start exam →
                        </button>
                      ) : !exam.isActive ? (
                        <span style={{ fontSize: 13, color: "var(--text-hint)" }}>Not available</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Admin controls */}
                  {isPrivileged && (
                    <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: "0.5px solid var(--border-soft)" }}>
                      <button
                        onClick={() => toggleActive(exam.id, !exam.isActive)}
                        style={{ padding: "7px 16px", borderRadius: 8, border: `0.5px solid ${exam.isActive ? "#7f1d1d" : "#14532d"}`, background: exam.isActive ? "#1f0707" : "#052e16", color: exam.isActive ? "#f87171" : "#4ade80", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                      >
                        {exam.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}


