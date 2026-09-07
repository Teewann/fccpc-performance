'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const AGENCY = {
  name: 'FCCPC',
  fullName: 'Federal Competition and Consumer Protection Commission',
  tagline: 'Protecting Markets. Empowering Consumers.',
  description:
    'Nigeria\'s apex regulatory authority for fair competition and consumer protection — ensuring transparent markets for every Nigerian.',
  stats: [
    { value: '2019', label: 'Established' },
    { value: '36', label: 'States Covered' },
    { value: '200M+', label: 'Consumers Protected' },
  ],
};

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          --green-glow: rgba(34, 197, 94, 0.25);
          --text-primary: #f0f4ff;
          --text-secondary: #94a3b8;
          --text-muted: #4b5e7a;
          --divider: rgba(148, 163, 184, 0.1);
        }

        html, body { height: 100%; }

        .page {
          min-height: 100vh;
          background: var(--bg-base);
          position: relative;
          overflow: hidden;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        }

        /* Ambient background glow */
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
          background: radial-gradient(ellipse, rgba(34, 197, 94, 0.06) 0%, transparent 70%);
        }
        .bg-glow::after {
          content: '';
          position: absolute;
          bottom: -20%;
          right: -10%;
          width: 50%;
          height: 60%;
          background: radial-gradient(ellipse, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
        }

        /* Watermark */
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
          width: min(480px, 70vw);
          height: auto;
          opacity: 0.045;
          filter: grayscale(100%) contrast(0.8);
          user-select: none;
        }

        /* Grid overlay — subtle */
        .grid-overlay {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.025) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* Layout */
        .layout {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 440px;
          grid-template-rows: auto 1fr auto;
          gap: 0;
        }

        /* Top bar */
        .topbar {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          border-bottom: 1px solid var(--divider);
          backdrop-filter: blur(8px);
        }
        .topbar-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .topbar-logo {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(34, 197, 94, 0.3);
          flex-shrink: 0;
        }
        .topbar-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .topbar-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .topbar-sub {
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .topbar-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--green);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 20px;
          padding: 5px 12px;
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

        /* Hero — left column */
        .hero {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 64px 64px 64px 64px;
          max-width: 680px;
        }

        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          color: var(--green);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 28px;
        }
        .hero-eyebrow-line {
          width: 28px;
          height: 1px;
          background: var(--green);
          opacity: 0.6;
        }

        .hero-headline {
          font-size: clamp(36px, 4.5vw, 56px);
          font-weight: 800;
          line-height: 1.08;
          color: var(--text-primary);
          letter-spacing: -0.025em;
          margin-bottom: 24px;
        }
        .hero-headline em {
          font-style: normal;
          color: var(--green-light);
        }

        .hero-desc {
          font-size: 16px;
          line-height: 1.7;
          color: var(--text-secondary);
          max-width: 480px;
          margin-bottom: 48px;
        }

        /* Stats row */
        .stats {
          display: flex;
          gap: 0;
          border: 1px solid var(--divider);
          border-radius: 12px;
          overflow: hidden;
          width: fit-content;
        }
        .stat {
          padding: 20px 32px;
          border-right: 1px solid var(--divider);
          background: rgba(255,255,255,0.02);
        }
        .stat:last-child { border-right: none; }
        .stat-value {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* Mandate tags */
        .mandate-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 36px;
        }
        .mandate-tag {
          font-size: 12px;
          color: var(--text-secondary);
          border: 1px solid var(--divider);
          border-radius: 6px;
          padding: 5px 12px;
          background: rgba(255,255,255,0.025);
          letter-spacing: 0.02em;
        }

        /* Right column — CTA card */
        .sidebar {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          border-left: 1px solid var(--divider);
        }

        .cta-card {
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--bg-card-border);
          border-radius: 20px;
          padding: 40px 36px;
          box-shadow:
            0 0 0 1px rgba(34, 197, 94, 0.05),
            0 32px 80px rgba(0, 0, 0, 0.5),
            0 0 40px rgba(34, 197, 94, 0.04);
        }

        .card-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
        }
        .card-logo-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid rgba(34, 197, 94, 0.3);
          padding: 3px;
          margin-bottom: 14px;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.1);
        }
        .card-logo-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        .card-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          text-align: center;
          letter-spacing: -0.01em;
        }
        .card-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          margin-top: 5px;
          letter-spacing: 0.03em;
        }

        .card-divider {
          height: 1px;
          background: var(--divider);
          margin: 24px 0;
        }

        .card-body {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.65;
          text-align: center;
          margin-bottom: 28px;
        }

        /* Access roles */
        .access-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 28px;
        }
        .access-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .access-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          flex-shrink: 0;
          opacity: 0.8;
        }

        /* CTA Button */
        .btn-primary {
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 15px;
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
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(34, 197, 94, 0.35);
          background: linear-gradient(135deg, #15803d 0%, #16a34a 100%);
        }
        .btn-primary:active {
          transform: translateY(0);
        }

        .btn-arrow {
          font-size: 18px;
          transition: transform 0.2s ease;
        }
        .btn-primary:hover .btn-arrow {
          transform: translateX(3px);
        }

        .card-note {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
          margin-top: 16px;
          line-height: 1.5;
        }

        /* Footer */
        .footer {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          border-top: 1px solid var(--divider);
        }
        .footer-left {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.03em;
        }
        .footer-right {
          display: flex;
          gap: 20px;
        }
        .footer-link {
          font-size: 11px;
          color: var(--text-muted);
          text-decoration: none;
          letter-spacing: 0.03em;
          transition: color 0.15s;
        }
        .footer-link:hover { color: var(--text-secondary); }

        /* Mobile */
        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .topbar { padding: 16px 24px; }
          .hero {
            grid-column: 1;
            grid-row: 2;
            padding: 40px 24px;
            max-width: 100%;
          }
          .sidebar {
            grid-column: 1;
            grid-row: 3;
            border-left: none;
            border-top: 1px solid var(--divider);
            padding: 32px 24px;
          }
          .footer { padding: 16px 24px; flex-direction: column; gap: 10px; text-align: center; }
          .footer-right { justify-content: center; }
          .stats { flex-direction: column; width: 100%; }
          .stat { border-right: none; border-bottom: 1px solid var(--divider); }
          .stat:last-child { border-bottom: none; }
          .topbar-badge { display: none; }
          .watermark img { width: min(320px, 80vw); }
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
                <div className="topbar-sub">Federal Republic of Nigeria</div>
              </div>
            </div>
            <div className="topbar-badge">Official System — Authorized Access Only</div>
          </header>

          {/* Hero */}
          <main className="hero">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-line" />
              Performance Management System
            </div>

            <h1 className="hero-headline">
              Protecting <em>Markets.</em><br />
              Empowering <em>Consumers.</em>
            </h1>

            <p className="hero-desc">
              {AGENCY.description}
            </p>

            <div className="stats">
              {AGENCY.stats.map((s) => (
                <div className="stat" key={s.label}>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="mandate-list">
              {['Competition Regulation', 'Consumer Protection', 'Market Surveillance', 'Merger Review', 'Enforcement'].map((t) => (
                <span className="mandate-tag" key={t}>{t}</span>
              ))}
            </div>
          </main>

          {/* CTA Sidebar */}
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

          {/* Footer */}
          <footer className="footer">
            <span className="footer-left">
              © {new Date().getFullYear()} Federal Competition and Consumer Protection Commission · Nigeria
            </span>
            <nav className="footer-right">
              <a className="footer-link" href="#">Privacy Policy</a>
              <a className="footer-link" href="#">Accessibility</a>
              <a className="footer-link" href="#">Contact</a>
            </nav>
          </footer>
        </div>
      </div>
    </>
  );
}
