"use client";
import { useState, useEffect } from "react";
import { getSessionTimeout, setSessionTimeout } from "@/hooks/useAutoLogout";

const OPTIONS = [
  { label: "10 minutes",  value: 10  },
  { label: "20 minutes",  value: 20  },
  { label: "30 minutes",  value: 30  },
  { label: "1 hour",      value: 60  },
  { label: "2 hours",     value: 120 },
  { label: "Never",       value: 999 },
];

export default function SessionTimeoutSetting() {
  const [current, setCurrent] = useState(30);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    setCurrent(getSessionTimeout());
  }, []);

  function handleChange(value: number) {
    setCurrent(value);
    setSessionTimeout(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
        Auto logout timer
      </div>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
        Your session will automatically end after this period of inactivity.
        You will receive a warning 1 minute before logout.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 14,
              fontWeight: current === opt.value ? 600 : 400,
              border: `0.5px solid ${current === opt.value ? "var(--accent)" : "var(--border)"}`,
              background: current === opt.value ? "var(--accent-bg)" : "var(--bg-input)",
              color: current === opt.value ? "var(--accent-text)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {saved && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--accent-text)", fontWeight: 500 }}>
          ✓ Session timeout updated
        </div>
      )}
    </div>
  );
}
