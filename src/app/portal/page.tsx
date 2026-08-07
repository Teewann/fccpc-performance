"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";

type PortalView = "home" | "register" | "status" | "success";

const SECTORS = [
  "TELECOMMUNICATIONS", "BANKING & FINANCE", "RETAIL & E-COMMERCE",
  "MANUFACTURING", "INSURANCE", "ENERGY & UTILITIES", "HEALTHCARE",
  "TRANSPORTATION", "HOSPITALITY", "TECHNOLOGY", "MEDIA", "OTHER",
];

const SECTOR_VALUES: Record<string, string> = {
  "TELECOMMUNICATIONS":   "TELECOMMUNICATIONS",
  "BANKING & FINANCE":    "BANKING_FINANCE",
  "RETAIL & E-COMMERCE":  "RETAIL_ECOMMERCE",
  "MANUFACTURING":        "MANUFACTURING",
  "INSURANCE":            "INSURANCE",
  "ENERGY & UTILITIES":   "ENERGY_UTILITIES",
  "HEALTHCARE":           "HEALTHCARE",
  "TRANSPORTATION":       "TRANSPORTATION",
  "HOSPITALITY":          "HOSPITALITY",
  "TECHNOLOGY":           "TECHNOLOGY",
  "MEDIA":                "MEDIA",
  "OTHER":                "OTHER",
};

const FEE_SCHEDULE = [
  { label: "Business registration",     amount: 50000,  note: "One-time fee, paid on first registration", icon: "🏢"  },
  { label: "Annual renewal",            amount: 25000,  note: "Due every January to stay active",         icon: "🔄"  },
  { label: "Compliance report filing",  amount: 10000,  note: "Per report submitted to FCCPC",            icon: "📋"  },
  { label: "Compliance certificate",    amount: 15000,  note: "Issued after successful verification",     icon: "🏆"  },
];

const EMPTY = {
  businessName: "", rcNumber: "", tin: "", sector: "TELECOMMUNICATIONS",
  email: "", phone: "", address: "", state: "",
  contactPerson: "", contactRole: "", password: "", confirmPassword: "",
};

function fmt(n: number) { return `₦${n.toLocaleString("en-NG")}`; }

export default function BusinessPortalPage() {
  const [view,       setView]       = useState<PortalView>("home");
  const [form,       setForm]       = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [msg,        setMsg]        = useState({ text: "", ok: true });
  const [result,     setResult]     = useState<any | null>(null);
  const [dark,       setDark]       = useState(true);

  // Status check
  const [rcInput,    setRcInput]    = useState("");
  const [bizStatus,  setBizStatus]  = useState<any | null>(null);
  const [checking,   setChecking]   = useState(false);
  const [statusMsg,  setStatusMsg]  = useState("");

  // ── Theme tokens ────────────────────────────────────────────────────
  const T = {
    bg:           dark ? "#020617"  : "#f4f6f9",
    card:         dark ? "#0f172a"  : "#ffffff",
    cardAlt:      dark ? "#0a0f1e"  : "#f8fafc",
    border:       dark ? "#1e293b"  : "#e2e8f0",
    borderSoft:   dark ? "#162032"  : "#eef2f7",
    text1:        dark ? "#f1f5f9"  : "#0f172a",
    text2:        dark ? "#64748b"  : "#64748b",
    text3:        dark ? "#94a3b8"  : "#94a3b8",
    green:        "#22c55e",
    greenDark:    dark ? "#052e16"  : "#f0fdf4",
    greenBorder:  dark ? "#14532d"  : "#bbf7d0",
    greenText:    dark ? "#4ade80"  : "#16a34a",
    navBg:        dark ? "#020617"  : "#ffffff",
    inputBg:      dark ? "#0a0f1e"  : "#f8fafc",
    shadow:       dark ? "none"     : "0 1px 3px rgba(0,0,0,0.07)",
  };

  const inp: React.CSSProperties = {
    width: "100%", background: T.inputBg, border: `0.5px solid ${T.border}`,
    borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.text1,
    outline: "none", boxSizing: "border-box" as const, marginBottom: 14,
    transition: "border-color 0.15s",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: T.text2,
    marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const primaryBtn: React.CSSProperties = {
    padding: "13px 28px", borderRadius: 10, fontSize: 14, fontWeight: 700,
    border: `1.5px solid ${T.green}`, background: T.greenDark,
    color: T.greenText, cursor: "pointer", transition: "opacity 0.15s",
  };
  const ghostBtn: React.CSSProperties = {
    padding: "13px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600,
    border: `0.5px solid ${T.border}`, background: "transparent",
    color: T.text3, cursor: "pointer",
  };

  // ── Register ────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    if (form.password !== form.confirmPassword) {
      setMsg({ text: "Passwords do not match.", ok: false }); return;
    }
    if (form.password.length < 8) {
      setMsg({ text: "Password must be at least 8 characters.", ok: false }); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        action:        "register_business",
        businessName:  form.businessName.trim(),
        rcNumber:      form.rcNumber.trim(),
        tin:           form.tin.trim() || undefined,
        sector:        SECTOR_VALUES[form.sector] || form.sector,
        email:         form.email.trim().toLowerCase(),
        phone:         form.phone.trim(),
        address:       form.address.trim(),
        state:         form.state.trim(),
        contactPerson: form.contactPerson.trim(),
        contactRole:   form.contactRole.trim(),
        password:      form.password,
      };
      const res  = await fetch("/api/portal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      let data: any = {};
      try { data = await res.json(); } catch { /* empty body */ }
      if (res.ok && data.success) {
        setResult(data);
        setForm(EMPTY);
        setView("success");
      } else {
        setMsg({ text: data.error || `Server error (${res.status}). Please try again.`, ok: false });
      }
    } catch (err) {
      console.error("[Portal register error]", err);
      setMsg({ text: "Could not reach the server. Please check your connection.", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Check status ─────────────────────────────────────────────────────
  async function handleCheckStatus() {
    if (!rcInput.trim()) { setStatusMsg("Please enter your RC number."); return; }
    setChecking(true); setBizStatus(null); setStatusMsg("");
    try {
      const res  = await fetch(`/api/portal?rc=${encodeURIComponent(rcInput.trim().toUpperCase())}`);
      const data = await res.json();
      if (res.ok && data.business) {
        setBizStatus(data.business);
      } else {
        setStatusMsg(data.error || "No business found with that RC number.");
      }
    } catch {
      setStatusMsg("Could not reach the server. Please check your connection.");
    } finally {
      setChecking(false);
    }
  }

  // ── Nav ───────────────────────────────────────────────────────────────
  function Nav() {
    return (
      <nav style={{
        borderBottom: `0.5px solid ${T.border}`,
        padding: "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, position: "sticky", top: 0,
        background: T.navBg,
        boxShadow: T.shadow,
        zIndex: 100,
        transition: "background 0.2s",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: T.greenDark, border: `1.5px solid ${T.green}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: T.greenText,
          }}>FC</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text1, lineHeight: 1.2 }}>FCCPC</div>
            <div style={{ fontSize: 10, color: T.text2 }}>Business Compliance Portal</div>
          </div>
        </div>

        {/* Nav links + theme toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {([["home","Home"],["register","Register"],["status","Check status"]] as [PortalView,string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setView(v); setMsg({ text:"",ok:true }); setBizStatus(null); setStatusMsg(""); }}
              style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: view === v ? `0.5px solid ${T.green}` : `0.5px solid ${T.border}`,
                background: view === v ? T.greenDark : "transparent",
                color: view === v ? T.greenText : T.text3,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}

          {/* Dark/light toggle */}
          <button
            onClick={() => setDark(!dark)}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              marginLeft: 8,
              width: 38, height: 38, borderRadius: 10,
              background: T.card, border: `0.5px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </nav>
    );
  }

  // ── Section header helper ─────────────────────────────────────────────
  function SectionCard({ title, children, borderAccent }: { title: string; children: React.ReactNode; borderAccent?: boolean }) {
    return (
      <div style={{
        background: T.card,
        border: `0.5px solid ${borderAccent ? T.green : T.border}`,
        borderRadius: 14, padding: 24, marginBottom: 16,
        boxShadow: T.shadow,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: T.text2,
          marginBottom: 18, paddingBottom: 12,
          borderBottom: `0.5px solid ${T.borderSoft}`,
          textTransform: "uppercase", letterSpacing: "0.07em",
        }}>
          {title}
        </div>
        {children}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.text1,
      fontFamily: "system-ui, -apple-system, sans-serif",
      transition: "background 0.2s, color 0.2s",
    }}>
      <Nav />

      {/* Background grid (dark mode only) */}
      {dark && (
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: "linear-gradient(rgba(34,197,94,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(34,197,94,0.02) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
      )}

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "44px 24px", position: "relative", zIndex: 1 }}>

        {/* ── SUCCESS ─────────────────────────────────────────────── */}
        {view === "success" && result && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: T.greenDark, border: `2px solid ${T.green}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, margin: "0 auto 20px",
            }}>✅</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: T.text1, marginBottom: 10 }}>
              Registration submitted!
            </h1>
            <p style={{ fontSize: 15, color: T.text2, marginBottom: 36, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 36px" }}>
              <strong style={{ color: T.greenText }}>{result.businessName}</strong> has been submitted.<br />
              FCCPC will review your application within 5–7 working days.
            </p>

            {/* Invoice */}
            <div style={{
              background: T.card, border: `1.5px solid ${T.greenBorder}`,
              borderRadius: 16, padding: 28, marginBottom: 20, textAlign: "left",
              boxShadow: T.shadow,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 20, paddingBottom: 16, borderBottom: `0.5px solid ${T.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text1 }}>🧾 Registration Invoice</div>
                  <div style={{ fontSize: 12, color: T.text2, marginTop: 3 }}>Ref: {result.reference}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: T.green }}>{fmt(result.amount)}</div>
                  <div style={{ fontSize: 11, color: T.text2 }}>Registration fee</div>
                </div>
              </div>

              <div style={{
                background: T.greenDark, border: `0.5px solid ${T.greenBorder}`,
                borderRadius: 10, padding: "18px 20px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.greenText, marginBottom: 12 }}>
                  Payment instructions
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, color: dark ? "#86efac" : "#15803d" }}>
                  {[
                    ["Bank",           result.paymentInstructions?.bankName      || "Central Bank of Nigeria"],
                    ["Account name",   result.paymentInstructions?.accountName   || "FCCPC Revenue Account"],
                    ["Account number", result.paymentInstructions?.accountNumber || "0123456789"],
                    ["Amount",         fmt(result.amount)],
                    ["Reference",      result.reference],
                    ["Business",       result.businessName],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: T.greenBorder, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <div style={{ fontWeight: 600, marginTop: 3 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                background: dark ? "#1c1107" : "#fffbeb",
                border: `0.5px solid ${dark ? "#78350f" : "#fde68a"}`,
                borderRadius: 10, padding: "12px 16px",
                fontSize: 13, color: dark ? "#fcd34d" : "#92400e", lineHeight: 1.6,
              }}>
                <strong>Important:</strong> After making payment, send your receipt to{" "}
                <strong style={{ color: T.greenText }}>compliance@fccpc.gov.ng</strong> with subject line:{" "}
                <strong style={{ color: T.text1 }}>{result.reference}</strong>
              </div>
            </div>

            {/* Steps */}
            <div style={{
              background: T.card, border: `0.5px solid ${T.border}`,
              borderRadius: 14, padding: 24, marginBottom: 24, textAlign: "left",
              boxShadow: T.shadow,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text1, marginBottom: 18 }}>What happens next?</div>
              {[
                ["Pay the registration fee",  `Transfer ${fmt(result.amount)} using the details above`],
                ["Email payment proof",       `Send receipt to compliance@fccpc.gov.ng with ref: ${result.reference}`],
                ["FCCPC verifies",            "Your CAC registration and business details are verified within 5–7 working days"],
                ["Certificate issued",        "Your compliance certificate is emailed and portal access activated"],
              ].map(([title, desc], i) => (
                <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: T.greenDark, border: `1.5px solid ${T.green}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: T.greenText, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{title}</div>
                    <div style={{ fontSize: 13, color: T.text2, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => { setView("status"); setRcInput(result.rcNumber || ""); }} style={primaryBtn}>
                Check my registration status →
              </button>
              <button onClick={() => window.print()} style={ghostBtn}>
                🖨 Print invoice
              </button>
            </div>
          </div>
        )}

        {/* ── HOME ────────────────────────────────────────────────── */}
        {view === "home" && (
          <div>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 11, fontWeight: 600, padding: "5px 16px",
                borderRadius: 20, background: T.greenDark,
                color: T.greenText, border: `0.5px solid ${T.greenBorder}`,
                marginBottom: 20, letterSpacing: "0.05em",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block" }} />
                Official FCCPC Business Compliance Portal
              </div>
              <h1 style={{
                fontSize: 38, fontWeight: 800, color: T.text1,
                letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 16,
              }}>
                Register your business.<br />
                <span style={{ color: T.green }}>Stay compliant. Stay protected.</span>
              </h1>
              <p style={{
                fontSize: 16, color: T.text2, maxWidth: 540,
                margin: "0 auto 36px", lineHeight: 1.7,
              }}>
                All businesses under FCCPC jurisdiction must register on this portal.
                Compliance with the Federal Competition and Consumer Protection Act 2018 is mandatory.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setView("register")} style={{ ...primaryBtn, fontSize: 15 }}>
                  Register your business →
                </button>
                <button onClick={() => setView("status")} style={{ ...ghostBtn, fontSize: 15 }}>
                  Check status
                </button>
              </div>
            </div>

            {/* Fee schedule */}
            <div style={{ marginBottom: 48 }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginBottom: 6 }}>Fee schedule</h2>
                <p style={{ fontSize: 14, color: T.text2 }}>Transparent, government-regulated fees</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
                {FEE_SCHEDULE.map((f) => (
                  <div key={f.label} style={{
                    background: T.card, border: `0.5px solid ${T.border}`,
                    borderRadius: 14, padding: "22px 24px",
                    boxShadow: T.shadow, transition: "border-color 0.15s",
                    display: "flex", gap: 16, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: T.greenDark, border: `0.5px solid ${T.greenBorder}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0,
                    }}>{f.icon}</div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: T.green, marginBottom: 4, letterSpacing: "-0.02em" }}>{fmt(f.amount)}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text1, marginBottom: 3 }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: T.text2 }}>{f.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Why register */}
            <div style={{
              background: T.card, border: `0.5px solid ${T.border}`,
              borderRadius: 16, padding: "28px 32px", boxShadow: T.shadow,
            }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text1, marginBottom: 22 }}>
                Why register with FCCPC?
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {[
                  ["⚖️","Legal compliance",        "Operating without registration violates FCCPA 2018 and attracts fines"],
                  ["🛡️","Consumer protection",     "Demonstrates your commitment to fair trade and consumer rights in Nigeria"],
                  ["📋","Digital submissions",     "Submit compliance reports and receive official FCCPC notices digitally"],
                  ["🏆","Compliance certificate",  "Receive an official FCCPC certificate to display to customers and partners"],
                ].map(([icon, title, desc]) => (
                  <div key={title as string} style={{
                    display: "flex", gap: 14,
                    padding: "16px", borderRadius: 12,
                    background: T.cardAlt, border: `0.5px solid ${T.borderSoft}`,
                  }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text1, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA strip */}
            <div style={{
              marginTop: 28,
              background: T.greenDark, border: `0.5px solid ${T.greenBorder}`,
              borderRadius: 14, padding: "22px 28px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.greenText, marginBottom: 3 }}>
                  Ready to register?
                </div>
                <div style={{ fontSize: 13, color: dark ? "#86efac" : "#15803d" }}>
                  Takes under 2 minutes · Payment after submission
                </div>
              </div>
              <button onClick={() => setView("register")} style={primaryBtn}>
                Start registration →
              </button>
            </div>
          </div>
        )}

        {/* ── REGISTER ────────────────────────────────────────────── */}
        {view === "register" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text1, marginBottom: 6 }}>
                Register your business
              </h2>
              <p style={{ fontSize: 14, color: T.text2 }}>
                Registration fee: <strong style={{ color: T.greenText }}>{fmt(50000)}</strong> · Payment instructions provided after submission · Takes 2 minutes
              </p>
            </div>

            {msg.text && (
              <div style={{
                background: msg.ok ? T.greenDark : (dark ? "#1f0707" : "#fef2f2"),
                border: `0.5px solid ${msg.ok ? T.greenBorder : (dark ? "#7f1d1d" : "#fecaca")}`,
                color: msg.ok ? T.greenText : (dark ? "#f87171" : "#dc2626"),
                borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 20,
              }}>
                {msg.ok ? "✓ " : "⚠ "}{msg.text}
              </div>
            )}

            <form onSubmit={handleRegister} autoComplete="off">
              {/* Business info */}
              <SectionCard title="Business information">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={lbl}>Business name *</label>
                    <input style={inp} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Full registered business name" required />
                  </div>
                  <div>
                    <label style={lbl}>RC Number (CAC) *</label>
                    <input style={inp} value={form.rcNumber} onChange={(e) => setForm({ ...form, rcNumber: e.target.value.toUpperCase() })} placeholder="RC1234567" required />
                  </div>
                  <div>
                    <label style={lbl}>TIN (optional)</label>
                    <input style={inp} value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} placeholder="Tax Identification Number" />
                  </div>
                  <div>
                    <label style={lbl}>Business sector *</label>
                    <select style={inp} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                      {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>State *</label>
                    <input style={inp} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Lagos" required />
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={lbl}>Registered address *</label>
                    <input style={inp} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full business address" required />
                  </div>
                </div>
              </SectionCard>

              {/* Contact info */}
              <SectionCard title="Contact & portal access">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={lbl}>Business email *</label>
                    <input style={inp} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="compliance@yourbusiness.com" required />
                  </div>
                  <div>
                    <label style={lbl}>Phone *</label>
                    <input style={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2348..." required />
                  </div>
                  <div>
                    <label style={lbl}>Compliance officer name *</label>
                    <input style={inp} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="Full name" required />
                  </div>
                  <div>
                    <label style={lbl}>Officer title / role *</label>
                    <input style={inp} value={form.contactRole} onChange={(e) => setForm({ ...form, contactRole: e.target.value })} placeholder="e.g. Compliance Manager" required />
                  </div>
                  <div>
                    <label style={lbl}>Create portal password *</label>
                    <input style={inp} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" autoComplete="new-password" required />
                  </div>
                  <div>
                    <label style={lbl}>Confirm password *</label>
                    <input style={inp} type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Repeat password" autoComplete="new-password" required />
                  </div>
                </div>
              </SectionCard>

              {/* Declaration */}
              <div style={{
                background: T.greenDark, border: `0.5px solid ${T.greenBorder}`,
                borderRadius: 10, padding: "14px 18px", marginBottom: 20,
                fontSize: 13, color: dark ? "#86efac" : "#15803d", lineHeight: 1.6,
              }}>
                <strong style={{ color: T.greenText }}>Declaration:</strong> By submitting this form, you confirm that all information provided is accurate and matches your CAC registration. Providing false information is an offence under FCCPA 2018.
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{ ...primaryBtn, width: "100%", fontSize: 15, padding: "14px", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "⏳ Submitting registration..." : `Submit & get payment invoice for ${fmt(50000)} →`}
              </button>
            </form>
          </div>
        )}

        {/* ── STATUS ──────────────────────────────────────────────── */}
        {view === "status" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: T.text1, marginBottom: 6 }}>
                Check registration status
              </h2>
              <p style={{ fontSize: 14, color: T.text2 }}>
                Enter your CAC RC number to view your compliance status and payment records
              </p>
            </div>

            <div style={{
              background: T.card, border: `0.5px solid ${T.border}`,
              borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: T.shadow,
            }}>
              <label style={lbl}>RC number</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={rcInput}
                  onChange={(e) => setRcInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCheckStatus(); }}
                  placeholder="Enter RC number e.g. RC1234567"
                  style={{ ...inp, flex: 1, marginBottom: 0 }}
                />
                <button
                  onClick={handleCheckStatus}
                  disabled={checking || !rcInput.trim()}
                  style={{ ...primaryBtn, flexShrink: 0, opacity: (checking || !rcInput.trim()) ? 0.5 : 1 }}
                >
                  {checking ? "Checking..." : "Check →"}
                </button>
              </div>
            </div>

            {statusMsg && (
              <div style={{
                background: dark ? "#1f0707" : "#fef2f2",
                border: `0.5px solid ${dark ? "#7f1d1d" : "#fecaca"}`,
                color: dark ? "#f87171" : "#dc2626",
                borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 20,
              }}>
                ⚠ {statusMsg}
              </div>
            )}

            {bizStatus && (
              <div style={{
                background: T.card, border: `0.5px solid ${T.border}`,
                borderRadius: 16, padding: 28, boxShadow: T.shadow,
              }}>
                {/* Header */}
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  marginBottom: 22, paddingBottom: 18, borderBottom: `0.5px solid ${T.border}`,
                  flexWrap: "wrap", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.text1, marginBottom: 4 }}>
                      {bizStatus.businessName}
                    </div>
                    <div style={{ fontSize: 13, color: T.text2 }}>
                      RC: {bizStatus.rcNumber} · {bizStatus.sector?.replace(/_/g, " ")} · {bizStatus.contactPerson}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700, padding: "7px 18px", borderRadius: 8,
                    background: bizStatus.status === "ACTIVE"
                      ? T.greenDark
                      : bizStatus.status === "PENDING_VERIFICATION"
                      ? (dark ? "#1c1107" : "#fffbeb")
                      : (dark ? "#1f0707" : "#fef2f2"),
                    color: bizStatus.status === "ACTIVE"
                      ? T.greenText
                      : bizStatus.status === "PENDING_VERIFICATION"
                      ? "#f59e0b"
                      : (dark ? "#f87171" : "#dc2626"),
                    border: `0.5px solid ${bizStatus.status === "ACTIVE"
                      ? T.greenBorder
                      : bizStatus.status === "PENDING_VERIFICATION"
                      ? "#78350f"
                      : (dark ? "#7f1d1d" : "#fecaca")}`,
                  }}>
                    {bizStatus.status === "ACTIVE"
                      ? "✓ Compliant & Active"
                      : bizStatus.status === "PENDING_VERIFICATION"
                      ? "⏳ Pending verification"
                      : "⚠ " + bizStatus.status}
                  </span>
                </div>

                {/* Status cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Registration fee", value: bizStatus.feePaid ? "✓ Paid" : "✗ Unpaid", color: bizStatus.feePaid ? T.green : (dark ? "#f87171" : "#dc2626") },
                    { label: "Registered on",    value: new Date(bizStatus.createdAt).toLocaleDateString("en-GB"), color: T.text1 },
                    { label: "Verified on",      value: bizStatus.verifiedAt ? new Date(bizStatus.verifiedAt).toLocaleDateString("en-GB") : "Pending", color: T.text1 },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: T.cardAlt, border: `0.5px solid ${T.borderSoft}`,
                      borderRadius: 10, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 11, color: T.text2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Fee unpaid warning */}
                {!bizStatus.feePaid && (
                  <div style={{
                    background: dark ? "#1c1107" : "#fffbeb",
                    border: `0.5px solid ${dark ? "#78350f" : "#fde68a"}`,
                    borderRadius: 10, padding: "14px 16px", marginBottom: 16,
                    fontSize: 13, color: dark ? "#f59e0b" : "#92400e",
                  }}>
                    ⚠ Your registration fee of {fmt(bizStatus.registrationFee || 50000)} has not been confirmed.
                    Make payment and send proof to <strong>compliance@fccpc.gov.ng</strong>
                  </div>
                )}

                {/* Payment history */}
                {bizStatus.payments?.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: T.text2,
                      marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      Payment records
                    </div>
                    {bizStatus.payments.map((p: any, i: number) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "12px 0", borderBottom: `0.5px solid ${T.borderSoft}`,
                        fontSize: 13,
                      }}>
                        <div>
                          <div style={{ color: T.text1, fontWeight: 500 }}>
                            {p.type === "REGISTRATION_FEE" ? "Registration fee"
                              : p.type === "FINE_PAYMENT"    ? "Fine payment"
                              : p.type === "ANNUAL_RENEWAL"  ? "Annual renewal"
                              : p.type}
                          </div>
                          <div style={{ color: T.text2, fontSize: 11, marginTop: 2 }}>
                            {p.reference} · {new Date(p.createdAt).toLocaleDateString("en-GB")}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: p.status === "CONFIRMED" ? T.green : "#f59e0b" }}>
                            {fmt(p.amount)}
                          </div>
                          <div style={{ fontSize: 11, color: T.text2 }}>{p.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{
        borderTop: `0.5px solid ${T.border}`,
        padding: "24px 40px", marginTop: 40,
        background: T.card,
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 13, color: T.text2 }}>
            © {new Date().getFullYear()} Federal Competition and Consumer Protection Commission ·{" "}
            <a href="https://fccpc.gov.ng" style={{ color: T.green, textDecoration: "none" }}>fccpc.gov.ng</a>
          </div>
          <div style={{ fontSize: 12, color: T.text2 }}>
            Powered by FCCPC Performance Intelligence System
          </div>
        </div>
      </div>
    </div>
  );
}