// src/components/ui/ToastProvider.tsx
//
// One shared toast system for the whole app. Your tasks/page.tsx and
// users/page.tsx each currently have their own copy of this exact code —
// this extracts it once so every component (old and new) can call
// useToast() instead of re-implementing the same local state.
//
// Wire this into your root layout once:
//
//   // src/app/layout.tsx
//   import { ToastProvider } from "@/components/ui/ToastProvider";
//   ...
//   <ToastProvider>{children}</ToastProvider>

"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Toast = { id: number; text: string; ok: boolean };

const ToastContext = createContext<{ showToast: (text: string, ok?: boolean) => void } | null>(null);

let _toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(text: string, ok = true) {
    const id = ++_toastId;
    setToasts((p) => [...p, { id, text, ok }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }

  function remove(id: number) {
    setToasts((p) => p.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12,
            minWidth: 300, maxWidth: 420,
            background: t.ok ? "#052e16" : "#1f0707",
            border: `1px solid ${t.ok ? "#14532d" : "#7f1d1d"}`,
            color: t.ok ? "#4ade80" : "#f87171",
            fontSize: 14, fontWeight: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            pointerEvents: "all", animation: "slideIn 0.2s ease",
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{t.ok ? "✓" : "✕"}</span>
            <span style={{ flex: 1 }}>{t.text}</span>
            <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16, opacity: 0.7, padding: 0 }}>✕</button>
          </div>
        ))}
        <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }`}</style>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider> — wrap your root layout with it.");
  }
  return ctx;
}
