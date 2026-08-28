"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggleButton from "@/components/layout/ThemeToggleButton";

const AGENCY = {
  name: 'FCCPC',
  fullName: 'Federal Competition and Consumer Protection Commission',
  tagline: 'Performance Intelligence System',
  description:
    'A comprehensive digital platform for tracking KPIs, managing tasks, monitoring attendance, and generating real-time intelligence reports.',
  stats: [
    { value: '100+', label: 'Staff', color: '#4ade80' },
    { value: '12', label: 'Departments', color: '#60a5fa' },
    { value: '50+', label: 'KPIs Tracked', color: '#a78bfa' },
  ],
};

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg-base: #060c18;
          --bg-surface: #0d1526;
          --bg-card: #111f38;
          --bg-card-border: rgba(34, 197, 94, 0.15);
          --green: #22c55e;
          --green-light: #4ade80;
          --text-primary: #f0f4ff;
          --text-secondary: #94a3b8;
          --text-muted: #4b5e7a;
          --divider: rgba(148, 163, 184, 0.1);
          --shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
          --watermark-opacity: 0.025;
        }

        [data-theme="light"] {
          --bg-base: #f0f4f8;
          --bg-surface: #e8ecf2;
          --bg-card: #ffffff;
          --bg-card-border: rgba(34, 197, 94, 0.2);
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-muted: #94a3b8;
          --divider: rgba(15, 23, 42, 0.08);
          --shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
          --watermark-opacity: 0.06;
        }

        html, body { 
          height: 100%; 
          zoom: 0.85;
        }

        @media (max-width: 1400px) {
          html, body { zoom: 0.9; }
        }

        @media (max-width: 1200px) {
          html, body { zoom: 1; }
        }

        @media (max-width: 768px) {
          html, body { zoom: 1; }
        }

        .page {
          min-height: 100vh;
          background: var(--bg-base);
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
          transition: background 0.3s;
        }

        .bg-glow {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .bg-glow::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -10%;
          width: 60%;
          height: 70%;
          background: radial-gradient(ellipse, rgba(34, 197, 94, 0.05) 0%, transparent 70%);
        }
        .bg-glow::after {
          content: '';
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 50%;
          height: 60%;
          background: radial-gradient(ellipse, rgba(59, 130, 246, 0.04) 0%, transparent 70%);
        }

        .watermark {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 0;
        }
        .watermark img {
          width: min(550px, 75vw);
          height: auto;
          opacity: var(--watermark-opacity);
          filter: grayscale(100%) contrast(0.8);
          user-select: none;
          transition: opacity 0.3s;
        }

        .grid-overlay {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.015) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .layout {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 560px 1fr;
          grid-template-rows: auto 1fr auto;
          gap: 0;
        }

        .topbar {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          border-bottom: 1px solid var(--divider);
          backdrop-filter: blur(8px);
          background: var(--bg-base);
          transition: background 0.3s, border-color 0.3s;
        }
        .topbar-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .topbar-logo {
          width: 72px;
          height: 72px;
          border-radius: 14px;
          overflow: hidden;
          border: 1.5px solid rgba(34, 197, 94, 0.3);
          flex-shrink: 0;
        }
        .topbar-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .topbar-name {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.3s;
        }
        .topbar-sub {
          font-size: 13px;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-top: 2px;
          font-weight: 500;
          transition: color 0.3s;
        }
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .topbar-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: var(--green);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 20px;
          padding: 6px 14px;
          background: rgba(34, 197, 94, 0.05);
          letter-spacing: 0.04em;
        }
        .topbar-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 6px var(--green);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .sidebar {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          border-right: 1px solid var(--divider);
          transition: border-color 0.3s;
        }

        .cta-card {
          width: 100%;
          max-width: 520px;
          background: var(--bg-card);
          border: 1px solid var(--bg-card-border);
          border-radius: 24px;
          padding: 48px 44px;
          box-shadow: var(--shadow);
          transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
        }

        .card-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 24px;
        }
        .card-logo-ring {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border: 2.5px solid rgba(34, 197, 94, 0.3);
          padding: 4px;
          margin-bottom: 16px;
          box-shadow: 0 0 30px rgba(34, 197, 94, 0.12);
        }
        .card-logo-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        .card-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          text-align: center;
          letter-spacing: -0.01em;
          transition: color 0.3s;
        }
        .card-subtitle {
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          margin-top: 6px;
          letter-spacing: 0.03em;
          transition: color 0.3s;
        }

        .card-divider {
          height: 1px;
          background: var(--divider);
          margin: 24px 0;
          transition: background 0.3s;
        }

        .card-body {
          font-size: 15px;
          color: #60a5fa;
          line-height: 1.7;
          text-align: center;
          margin-bottom: 28px;
          font-weight: 500;
          transition: color 0.3s;
        }

        .access-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }
        .access-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: #60a5fa;
          font-weight: 500;
          transition: color 0.3s;
        }
        .access-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #60a5fa;
          flex-shrink: 0;
          opacity: 0.8;
        }

        .btn-primary {
          width: 100%;
          padding: 16px 24px;
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(34, 197, 94, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(34, 197, 94, 0.35);
          background: linear-gradient(135deg, #15803d 0%, #16a34a 100%);
        }
        .btn-primary:active {
          transform: translateY(0);
        }

        .btn-arrow {
          font-size: 20px;
          transition: transform 0.2s ease;
        }
        .btn-primary:hover .btn-arrow {
          transform: translateX(4px);
        }

        .card-note {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          margin-top: 16px;
          line-height: 1.6;
          transition: color 0.3s;
        }

        .hero {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 64px 64px 64px 64px;
        }

        .hero-eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--green);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 20px;
          text-align: center;
          width: 100%;
        }
        .hero-eyebrow-text {
          color: var(--green);
          font-weight: 700;
          padding: 0 16px;
        }

        .hero-headline {
          font-size: clamp(38px, 4.8vw, 56px);
          font-weight: 800;
          line-height: 1.08;
          color: #1a3a2a;
          letter-spacing: -0.025em;
          margin-bottom: 24px;
          text-align: center;
          transition: color 0.3s;
        }
        [data-theme="light"] .hero-headline {
          color: #0d2818;
        }
        .hero-headline em {
          font-style: normal;
          color: #1a5a3a;
        }
        [data-theme="light"] .hero-headline em {
          color: #0d3a22;
        }

        .hero-desc {
          font-size: 17px;
          line-height: 1.7;
          color: var(--text-secondary);
          max-width: 520px;
          margin-bottom: 48px;
          text-align: center;
          margin-left: auto;
          margin-right: auto;
          transition: color 0.3s;
        }

        .stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-bottom: 36px;
        }
        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-value {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .stat-label {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 6px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-weight: 600;
          transition: color 0.3s;
        }

        .mandate-list {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
        }
        .mandate-tag {
          font-size: 13px;
          font-weight: 600;
          border: 1px solid var(--divider);
          border-radius: 8px;
          padding: 6px 14px;
          background: rgba(255,255,255,0.025);
          letter-spacing: 0.02em;
          transition: color 0.3s, border-color 0.3s;
        }
        .mandate-tag:nth-child(1) { color: #a78bfa; border-color: rgba(167, 139, 250, 0.3); }
        .mandate-tag:nth-child(2) { color: #60a5fa; border-color: rgba(96, 165, 250, 0.3); }
        .mandate-tag:nth-child(3) { color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); }
        .mandate-tag:nth-child(4) { color: #f59e0b; border-color: rgba(245, 158, 11, 0.3); }
        .mandate-tag:nth-child(5) { color: #34d399; border-color: rgba(52, 211, 153, 0.3); }

        .footer {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 48px;
          border-top: 1px solid var(--divider);
          background: var(--bg-base);
          transition: background 0.3s, border-color 0.3s;
        }
        .footer-left {
          font-size: 14px;
          color: var(--text-muted);
          letter-spacing: 0.03em;
          font-weight: 500;
          transition: color 0.3s;
        }

        /* ─── Mobile Responsive ─── */
        @media (max-width: 1024px) {
          .layout {
            grid-template-columns: 1fr 1fr;
          }
          .sidebar { padding: 32px 24px; }
          .hero { padding: 40px 32px; }
          .cta-card { max-width: 100%; padding: 32px 28px; }
          .hero-headline { font-size: clamp(32px, 4vw, 42px); }
          .topbar { padding: 16px 24px; }
          .topbar-logo { width: 56px; height: 56px; }
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .topbar { padding: 16px 24px; flex-wrap: wrap; gap: 12px; }
          .topbar-badge { display: none; }
          .sidebar {
            grid-column: 1;
            grid-row: 2;
            border-right: none;
            border-bottom: 1px solid var(--divider);
            padding: 24px 20px;
          }
          .cta-card { padding: 24px 20px; max-width: 100%; }
          .hero {
            grid-column: 1;
            grid-row: 3;
            padding: 32px 20px;
          }
          .footer { padding: 16px 20px; flex-direction: column; gap: 10px; text-align: center; }
          .stats { flex-direction: row; flex-wrap: wrap; gap: 16px; justify-content: center; }
          .watermark img { width: min(320px, 80vw); }
          .topbar-actions { gap: 8px; }
          .card-logo-ring { width: 72px; height: 72px; }
          .card-title { font-size: 20px; }
          .hero-headline { font-size: 28px; }
          .hero-desc { font-size: 15px; padding: 0 8px; }
          .hero-eyebrow { font-size: 14px; flex-wrap: wrap; }
          .topbar-logo { width: 48px; height: 48px; }
          .topbar-name { font-size: 16px; }
          .topbar-sub { font-size: 11px; }
          .stat-value { font-size: 28px; }
          .stat-label { font-size: 12px; }
          .mandate-tag { font-size: 12px; padding: 4px 12px; }
          .cta-card { padding: 20px 16px; }
          .card-logo-ring { width: 60px; height: 60px; }
          .card-title { font-size: 18px; }
          .card-body { font-size: 14px; }
          .access-item { font-size: 13px; }
          .btn-primary { font-size: 15px; padding: 14px 20px; }
        }

        @media (max-width: 480px) {
          .topbar { padding: 12px 16px; }
          .topbar-name { font-size: 14px; }
          .topbar-sub { font-size: 10px; }
          .topbar-logo { width: 40px; height: 40px; border-radius: 10px; }
          .topbar-brand { gap: 10px; }
          .hero { padding: 24px 16px; }
          .hero-headline { font-size: 24px; }
          .hero-desc { font-size: 14px; margin-bottom: 28px; }
          .stats { gap: 12px; }
          .stat-value { font-size: 22px; }
          .stat-label { font-size: 11px; }
          .sidebar { padding: 16px; }
          .cta-card { padding: 16px; border-radius: 16px; }
          .card-logo-ring { width: 56px; height: 56px; }
          .card-title { font-size: 16px; }
          .card-subtitle { font-size: 12px; }
          .card-body { font-size: 13px; margin-bottom: 20px; }
          .access-item { font-size: 12px; }
          .btn-primary { font-size: 14px; padding: 12px 16px; }
          .card-note { font-size: 11px; }
          .mandate-list { gap: 6px; }
          .mandate-tag { font-size: 11px; padding: 4px 10px; }
          .footer { padding: 12px 16px; }
          .footer-left { font-size: 12px; }
          .hero-eyebrow { font-size: 12px; }
          .hero-eyebrow-text { padding: 0 8px; }
        }

        @media (max-width: 360px) {
          .topbar-name { font-size: 12px; }
          .topbar-sub { font-size: 9px; }
          .topbar-logo { width: 32px; height: 32px; }
          .hero-headline { font-size: 20px; }
          .stat-value { font-size: 18px; }
          .cta-card { padding: 12px; }
          .card-logo-ring { width: 48px; height: 48px; }
          .card-title { font-size: 14px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .btn-primary { transition: none; }
          .topbar-badge::before { animation: none; }
        }
      `}</style>

      <div className="page">
        {/* Watermark */}
        <div className="watermark" aria-hidden="true">
          <img src="/fccpc-logo.jpg" alt="" draggable={false} />
        </div>

        {/* Ambient glow */}
        <div className="bg-glow" aria-hidden="true" />
        <div className="grid-overlay" aria-hidden="true" />

        <div className="layout">
          {/* Top Bar */}
          <header className="topbar">
            <div className="topbar-brand">
              <div className="topbar-logo">
                <img src="/fccpc-logo.jpg" alt="FCCPC Logo" />
              </div>
              <div>
                <div className="topbar-name">FCCPC</div>
                <div className="topbar-sub">Performance Intelligence System</div>
              </div>
            </div>
            <div className="topbar-actions">
              <div className="topbar-badge">Official System  Authorized Access Only</div>
              <ThemeToggleButton />
            </div>
          </header>

          {/* Sidebar — CTA Card (Left) */}
          <aside className="sidebar">
            <div className="cta-card">
              <div className="card-logo-wrap">
                <div className="card-logo-ring">
                  <img className="card-logo-img" src="/fccpc-logo.jpg" alt="FCCPC" />
                </div>
                <div className="card-title">Staff Portal</div>
                <div className="card-subtitle">FCCPC Performance Management</div>
              </div>

              <div className="card-divider" />

              <p className="card-body">
                Access your performance dashboard, appraisals, and reports through the secure FCCPC staff portal.
              </p>

              <div className="access-list">
                {[
                  'Individual performance tracking',
                  'Departmental reporting & analytics',
                  'Goal-setting & appraisal management',
                  'Admin & HR oversight tools',
                ].map((item) => (
                  <div className="access-item" key={item}>
                    <span className="access-dot" />
                    {item}
                  </div>
                ))}
              </div>

              <button
                className="btn-primary"
                onClick={() => router.push('/auth/login')}
              >
                Sign In to Staff Portal
                <span className="btn-arrow">→</span>
              </button>

              <p className="card-note">
                Restricted to authorised FCCPC personnel only.<br />
                Contact your administrator if you need access.
              </p>
            </div>
          </aside>

          {/* Hero (Right) */}
          <main className="hero">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-text">Performance Management System</span>
            </div>

            <h1 className="hero-headline">
              Intelligence-Driven <em>Performance</em><br />
              Management
            </h1>

            <p className="hero-desc">
              {AGENCY.description}
            </p>

            <div className="stats">
              <div className="stat">
                <div className="stat-value" style={{ color: '#4ade80' }}>100+</div>
                <div className="stat-label">Staff</div>
              </div>
              <div className="stat">
                <div className="stat-value" style={{ color: '#60a5fa' }}>12</div>
                <div className="stat-label">Departments</div>
              </div>
              <div className="stat">
                <div className="stat-value" style={{ color: '#a78bfa' }}>50+</div>
                <div className="stat-label">KPIs Tracked</div>
              </div>
            </div>

            <div className="mandate-list">
              <span className="mandate-tag">Real-time KPIs</span>
              <span className="mandate-tag">Task Management</span>
              <span className="mandate-tag">Attendance Tracking</span>
              <span className="mandate-tag">Intelligence Reports</span>
              <span className="mandate-tag">Biometric Security</span>
            </div>
          </main>

          {/* Footer */}
          <footer className="footer">
            <span className="footer-left">
              © 2026 FCCPC Performance Intelligence System · Nigeria
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}