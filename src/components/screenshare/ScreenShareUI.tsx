// components/screenshare/ScreenShareUI.tsx
// ─────────────────────────────────────────────────────────────
// Self-contained UI for the Screen Share feature. Contains:
//   <ScreenShareButton>       — trigger button for sidebar/topbar
//   <ScreenShareRequestModal> — password + user picker
//   <ScreenShareIncomingModal>— accept/reject notification
//   <ScreenShareActiveBadge>  — "being viewed" banner
//   <ScreenShareViewerPanel>  — live view overlay
//   <ScreenShareOrchestrator> — mounts all of the above (add to layout)
// ─────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useScreenShare, UserSummary } from '@/components/screenshare/ScreenShareProvider';

// ─────────────────────────────────────────────────────────────
// 1. TRIGGER BUTTON
// ─────────────────────────────────────────────────────────────

export function ScreenShareButton({ compact = false }: { compact?: boolean }) {
  const { mySession, iAmTarget, isActive, setShowRequestModal, endSession, setShowViewerPanel, showViewerPanel } = useScreenShare();

  // If currently being viewed as target → show "Stop Sharing" button
  if (iAmTarget && isActive) {
    return (
      <button
        onClick={endSession}
        style={styles.btnDanger}
        title="Stop sharing your screen"
      >
        <RecordDot /> {compact ? '' : 'Stop Sharing'}
      </button>
    );
  }

  // If I'm the viewer → toggle panel button
  if (mySession && !iAmTarget) {
    return (
      <button
        onClick={() => setShowViewerPanel(!showViewerPanel)}
        style={{ ...styles.btnActive, ...(showViewerPanel ? styles.btnActiveOn : {}) }}
        title="Toggle live view panel"
      >
        <EyeIcon />
        {compact ? '' : (showViewerPanel ? ' Hide View' : ' Show View')}
      </button>
    );
  }

  // Default: open the request modal
  return (
    <button
      onClick={() => setShowRequestModal(true)}
      style={styles.btnDefault}
      title="Request screen share with another user"
    >
      <ScreenIcon />
      {compact ? '' : ' Share Screen'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. REQUEST MODAL (password + user picker)
// ─────────────────────────────────────────────────────────────

export function ScreenShareRequestModal() {
  const { showRequestModal, setShowRequestModal, verifyPassword, requestSession } = useScreenShare();

  const [step,       setStep]       = useState<'password' | 'pick'>('password');
  const [password,   setPassword]   = useState('');
  const [pwError,    setPwError]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [users,      setUsers]      = useState<UserSummary[]>([]);
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState<UserSummary | null>(null);
  const [reqError,   setReqError]   = useState('');
  const pwRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (showRequestModal) {
      setStep('password'); setPassword(''); setPwError('');
      setSearch(''); setSelected(null); setReqError('');
      setTimeout(() => pwRef.current?.focus(), 80);
    }
  }, [showRequestModal]);

  const handlePasswordSubmit = async () => {
    if (!password) { setPwError('Please enter your password.'); return; }
    setLoading(true); setPwError('');
    try {
      const ok = await verifyPassword(password);
      if (!ok) { setPwError('Incorrect password. Please try again.'); return; }
      // Load users
      const res  = await fetch('/api/screenshare/users');
      const data = await res.json();
      setUsers(data.users || []);
      setStep('pick');
    } catch {
      setPwError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    if (!selected) return;
    setLoading(true); setReqError('');
    try {
      await requestSession(selected.id);
    } catch (e: any) {
      setReqError(e.message || 'Failed to send request.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter((u) =>
    (u.name || u.email).toLowerCase().includes(search.toLowerCase())
  );

  if (!showRequestModal) return null;

  return (
    <div style={styles.overlay} onClick={() => setShowRequestModal(false)}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.modalHeaderIcon}><ScreenIcon /></div>
          <div>
            <h2 style={styles.modalTitle}>
              {step === 'password' ? 'Authenticate to Share Screen' : 'Select a User to View'}
            </h2>
            <p style={styles.modalSub}>
              {step === 'password'
                ? 'Enter your login password to confirm this action.'
                : 'The selected user will receive a request and must accept before viewing begins.'}
            </p>
          </div>
          <button style={styles.closeBtn} onClick={() => setShowRequestModal(false)}>✕</button>
        </div>

        {/* Security notice */}
        <div style={styles.notice}>
          <ShieldIcon />
          <span><strong>Screen sharing is logged and audited.</strong> The target user must accept before any viewing begins.</span>
        </div>

        {step === 'password' ? (
          /* ── Password Step ── */
          <div style={styles.modalBody}>
            <label style={styles.label}>Your Password</label>
            <input
              ref={pwRef}
              type="password"
              placeholder="Enter your login password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              style={{ ...styles.input, ...(pwError ? styles.inputError : {}) }}
              autoComplete="current-password"
            />
            {pwError && <p style={styles.errorText}>{pwError}</p>}
            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setShowRequestModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={handlePasswordSubmit} disabled={loading}>
                {loading ? 'Verifying…' : 'Continue →'}
              </button>
            </div>
          </div>
        ) : (
          /* ── User Picker Step ── */
          <div style={styles.modalBody}>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <div style={styles.userList}>
              {filtered.length === 0 && (
                <p style={styles.emptyText}>No users found.</p>
              )}
              {filtered.map((u) => (
                <button
                  key={u.id}
                  style={{
                    ...styles.userRow,
                    ...(selected?.id === u.id ? styles.userRowSelected : {}),
                  }}
                  onClick={() => setSelected(u)}
                >
                  <div style={styles.userAvatar}>
                    {u.image
                      ? <img src={u.image} alt="" style={styles.avatarImg} />
                      : <span style={styles.avatarInitial}>{(u.name || u.email)[0].toUpperCase()}</span>
                    }
                  </div>
                  <div style={styles.userInfo}>
                    <span style={styles.userName}>{u.name || '(No name)'}</span>
                    <span style={styles.userEmail}>{u.email}</span>
                  </div>
                  <span style={{ ...styles.roleBadge, ...getRoleBadgeStyle(u.role) }}>
                    {u.role}
                  </span>
                  {selected?.id === u.id && <span style={styles.checkmark}>✓</span>}
                </button>
              ))}
            </div>

            {reqError && <p style={styles.errorText}>{reqError}</p>}

            {selected && (
              <div style={styles.selectedPreview}>
                <span>Sending request to: <strong style={{ color: '#4ade80' }}>{selected.name || selected.email}</strong></span>
              </div>
            )}

            <div style={styles.modalFooter}>
              <button style={styles.btnSecondary} onClick={() => setStep('password')}>← Back</button>
              <button
                style={{ ...styles.btnPrimary, opacity: selected && !loading ? 1 : 0.5 }}
                onClick={handleRequest}
                disabled={!selected || loading}
              >
                {loading ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. INCOMING REQUEST MODAL (shown to the target)
// ─────────────────────────────────────────────────────────────

export function ScreenShareIncomingModal() {
  const { incomingRequest, respondToRequest } = useScreenShare();
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!incomingRequest) return;
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [incomingRequest?.id]);

  const respond = async (action: 'ACCEPT' | 'REJECT') => {
    if (!incomingRequest) return;
    setLoading(true);
    try { await respondToRequest(incomingRequest.id, action); }
    finally { setLoading(false); }
  };

  if (!incomingRequest || incomingRequest.status !== 'PENDING') return null;

  const requester = incomingRequest.requester;

  return (
    <div style={styles.incomingOverlay}>
      <div style={styles.incomingCard}>
        <div style={styles.incomingIcon}><EyeIcon /></div>
        <h3 style={styles.incomingTitle}>Screen View Request</h3>
        <p style={styles.incomingBody}>
          <strong style={{ color: '#f0f4ff' }}>{requester.name || requester.email}</strong>
          {' '}({requester.role}) wants to view your screen in real-time.
        </p>
        <p style={styles.incomingWarning}>
          ⚠ If you accept, they will see your current page, clicks, and actions.
          You can stop sharing at any time.
        </p>
        <div style={styles.countdown}>
          Auto-declines in <strong>{countdown}s</strong>
        </div>
        <div style={styles.incomingActions}>
          <button
            style={styles.btnReject}
            onClick={() => respond('REJECT')}
            disabled={loading}
          >
            Decline
          </button>
          <button
            style={styles.btnAccept}
            onClick={() => respond('ACCEPT')}
            disabled={loading}
          >
            {loading ? 'Accepting…' : '✓ Accept & Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. ACTIVE BADGE (shown to target while being viewed)
// ─────────────────────────────────────────────────────────────

export function ScreenShareActiveBadge() {
  const { iAmTarget, isActive, mySession, endSession } = useScreenShare();
  if (!iAmTarget || !isActive || !mySession) return null;

  return (
    <div style={styles.activeBadge}>
      <RecordDot />
      <span>
        <strong style={{ color: '#f0f4ff' }}>{mySession.requester.name || mySession.requester.email}</strong>
        {' '}is viewing your screen
      </span>
      <button style={styles.badgeStop} onClick={endSession}>Stop</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. VIEWER PANEL (the live view)
// ─────────────────────────────────────────────────────────────

export function ScreenShareViewerPanel() {
  const {
    showViewerPanel, mySession, liveHeartbeat,
    isStale, secondsSinceLastBeat, iAmViewer, isActive,
    endSession, setShowViewerPanel,
  } = useScreenShare();

  if (!showViewerPanel || !iAmViewer || !mySession) return null;

  const target = mySession.target;
  const hb     = liveHeartbeat;

  return (
    <div style={styles.panel}>
      {/* Panel Header */}
      <div style={styles.panelHeader}>
        <div style={styles.panelHeaderLeft}>
          <EyeIcon />
          <div>
            <div style={styles.panelTitle}>
              Live View — {target.name || target.email}
            </div>
            <div style={styles.panelSub}>{target.role} · {target.email}</div>
          </div>
        </div>
        <div style={styles.panelHeaderRight}>
          {isStale ? (
            <span style={styles.statusStale}>⚠ Connection lost</span>
          ) : isActive ? (
            <span style={styles.statusLive}><RecordDot /> Live</span>
          ) : (
            <span style={styles.statusWaiting}>⏳ Waiting for target…</span>
          )}
          <button style={styles.panelMinimize} onClick={() => setShowViewerPanel(false)} title="Minimize">−</button>
          <button style={styles.panelClose} onClick={endSession} title="End session">✕ End</button>
        </div>
      </div>

      {/* Main content */}
      {!isActive ? (
        <div style={styles.panelWaiting}>
          <div style={styles.waitingSpinner} />
          <p>Waiting for {target.name || target.email} to accept…</p>
          <button style={styles.btnSecondary} onClick={endSession}>Cancel Request</button>
        </div>
      ) : !hb ? (
        <div style={styles.panelWaiting}>
          <div style={styles.waitingSpinner} />
          <p>Connecting to {target.name || target.email}'s session…</p>
        </div>
      ) : (
        <div style={styles.panelContent}>
          {/* Connection health */}
          {secondsSinceLastBeat !== null && (
            <div style={styles.healthBar}>
              <span style={isStale ? styles.healthStale : styles.healthOk}>
                {isStale ? `⚠ Last update ${secondsSinceLastBeat}s ago` : `✓ Updated ${secondsSinceLastBeat}s ago`}
              </span>
            </div>
          )}

          {/* Current Page */}
          <Section title="📄 Current Page">
            <DataRow label="URL"   value={hb.currentUrl} mono />
            <DataRow label="Title" value={hb.pageTitle}  />
            <DataRow label="Scroll" value={`${hb.scrollY}px from top`} />
          </Section>

          {/* Last Click */}
          {hb.clickEvent && (
            <Section title="🖱 Last Click">
              <DataRow label="Element"  value={hb.clickEvent.selector} mono />
              <DataRow label="Text"     value={hb.clickEvent.text || '(no text)'} />
              <DataRow label="Position" value={`${hb.clickEvent.x}% × ${hb.clickEvent.y}% of viewport`} />
              <DataRow label="When"     value={timeAgo(hb.clickEvent.timestamp)} />
            </Section>
          )}

          {/* Last Action */}
          {hb.actionEvent && (
            <Section title="⚡ Last Action">
              <DataRow label="Type"   value={hb.actionEvent.type.replace('_', ' ')} />
              <DataRow label="Detail" value={hb.actionEvent.detail} />
              <DataRow label="When"   value={timeAgo(hb.actionEvent.timestamp)} />
            </Section>
          )}

          {/* Input Activity */}
          {hb.inputEvent && (
            <Section title="⌨ Typing Activity">
              <DataRow label="Field" value={hb.inputEvent.field} />
              <DataRow label="Value" value={hb.inputEvent.maskedValue} mono />
              <DataRow label="When"  value={timeAgo(hb.inputEvent.timestamp)} />
            </Section>
          )}

          {/* Last heartbeat timestamp */}
          <div style={styles.panelTimestamp}>
            Last heartbeat: {new Date(hb.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. ORCHESTRATOR — add ONE of these to your root layout
// ─────────────────────────────────────────────────────────────

export function ScreenShareOrchestrator() {
  return (
    <>
      <ScreenShareRequestModal />
      <ScreenShareIncomingModal />
      <ScreenShareActiveBadge />
      <ScreenShareViewerPanel />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={styles.dataRow}>
      <span style={styles.dataLabel}>{label}</span>
      <span style={{ ...styles.dataValue, ...(mono ? styles.mono : {}) }}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons (inline SVG — no external deps)
// ─────────────────────────────────────────────────────────────

function ScreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function RecordDot() {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: '#ef4444',
      boxShadow: '0 0 6px #ef4444',
      animation: 'ssRecordPulse 1.5s ease-in-out infinite',
      verticalAlign: 'middle',
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function getRoleBadgeStyle(role: string) {
  const map: Record<string, React.CSSProperties> = {
    ADMIN:     { background: 'rgba(239,68,68,0.15)',   color: '#f87171' },
    DIRECTOR:  { background: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
    EXECUTIVE: { background: 'rgba(234,179,8,0.15)',   color: '#facc15' },
    STAFF:     { background: 'rgba(148,163,184,0.1)',  color: '#94a3b8' },
  };
  return map[role] || map.STAFF;
}

// ─────────────────────────────────────────────────────────────
// Styles (dark-theme, matching your existing system)
// ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  // Buttons
  btnDefault: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgba(34,197,94,0.25)',
    background: 'rgba(34,197,94,0.08)',
    color: '#4ade80',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  },
  btnActive: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)',
    background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnActiveOn: { background: 'rgba(59,130,246,0.2)' },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#f87171',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnPrimary: {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#16a34a,#22c55e)',
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnSecondary: {
    padding: '10px 20px', borderRadius: 8,
    border: '1px solid rgba(148,163,184,0.2)',
    background: 'transparent', color: '#94a3b8',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnAccept: {
    flex: 1, padding: '12px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#16a34a,#22c55e)',
    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  btnReject: {
    flex: 1, padding: '12px', borderRadius: 8,
    border: '1px solid rgba(148,163,184,0.2)',
    background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  // Overlay & Modal
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9998, padding: 16,
  },
  modal: {
    width: '100%', maxWidth: 520,
    background: '#0d1526',
    border: '1px solid rgba(34,197,94,0.15)',
    borderRadius: 16,
    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 14,
    padding: '24px 24px 0',
  },
  modalHeaderIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#4ade80', flexShrink: 0,
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#f0f4ff', margin: 0 },
  modalSub:   { fontSize: 13, color: '#64748b', marginTop: 4 },
  closeBtn: {
    marginLeft: 'auto', background: 'none', border: 'none',
    color: '#475569', fontSize: 18, cursor: 'pointer', padding: 4,
    lineHeight: 1, flexShrink: 0,
  },
  notice: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    margin: '16px 24px 0',
    padding: '10px 14px', borderRadius: 8,
    background: 'rgba(234,179,8,0.06)',
    border: '1px solid rgba(234,179,8,0.15)',
    color: '#a16207', fontSize: 12, lineHeight: 1.5,
  },
  modalBody:   { padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 },
  label:    { fontSize: 13, fontWeight: 600, color: '#94a3b8' },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: 8,
    border: '1px solid rgba(148,163,184,0.15)',
    background: 'rgba(255,255,255,0.04)', color: '#f0f4ff',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  inputError: { border: '1px solid rgba(239,68,68,0.5)' },
  errorText:  { color: '#f87171', fontSize: 13, margin: 0 },
  emptyText:  { color: '#475569', fontSize: 13, textAlign: 'center', padding: '20px 0' },

  // User list
  userList: {
    maxHeight: 300, overflowY: 'auto', display: 'flex',
    flexDirection: 'column', gap: 4,
    border: '1px solid rgba(148,163,184,0.1)',
    borderRadius: 8, background: 'rgba(255,255,255,0.02)',
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: 'none', border: 'none',
    borderBottom: '1px solid rgba(148,163,184,0.06)',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'background 0.15s',
    color: 'inherit',
  },
  userRowSelected: { background: 'rgba(34,197,94,0.08)' },
  userAvatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(34,197,94,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg:     { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 15, fontWeight: 700, color: '#4ade80' },
  userInfo:  { flex: 1, display: 'flex', flexDirection: 'column' },
  userName:  { fontSize: 14, fontWeight: 600, color: '#f0f4ff' },
  userEmail: { fontSize: 12, color: '#475569' },
  roleBadge: {
    fontSize: 10, fontWeight: 700, padding: '2px 8px',
    borderRadius: 4, letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    border: '1px solid transparent',
  },
  checkmark: { color: '#4ade80', fontWeight: 700, fontSize: 16 },
  selectedPreview: {
    padding: '10px 14px', borderRadius: 8,
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.15)',
    fontSize: 13, color: '#64748b',
  },

  // Incoming modal
  incomingOverlay: {
    position: 'fixed', bottom: 24, right: 24,
    zIndex: 9999, maxWidth: 380,
  },
  incomingCard: {
    background: '#0d1526',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 16, padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  incomingIcon: {
    width: 44, height: 44, borderRadius: 12,
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#4ade80', alignSelf: 'flex-start',
  },
  incomingTitle: { fontSize: 16, fontWeight: 700, color: '#f0f4ff', margin: 0 },
  incomingBody:  { fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.5 },
  incomingWarning: {
    fontSize: 12, color: '#a16207', lineHeight: 1.5,
    padding: '8px 12px', borderRadius: 6,
    background: 'rgba(234,179,8,0.06)',
    border: '1px solid rgba(234,179,8,0.15)',
    margin: 0,
  },
  countdown:       { fontSize: 12, color: '#64748b', textAlign: 'center' as const },
  incomingActions: { display: 'flex', gap: 10, marginTop: 4 },

  // Active badge
  activeBadge: {
    position: 'fixed', top: 12, left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9997,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 18px', borderRadius: 100,
    background: 'rgba(13,21,38,0.95)',
    border: '1px solid rgba(239,68,68,0.4)',
    boxShadow: '0 4px 24px rgba(239,68,68,0.15)',
    fontSize: 13, color: '#94a3b8',
    backdropFilter: 'blur(12px)',
    whiteSpace: 'nowrap',
  },
  badgeStop: {
    padding: '4px 12px', borderRadius: 6,
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#f87171',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    marginLeft: 6,
  },

  // Viewer panel
  panel: {
    position: 'fixed', bottom: 24, right: 24,
    width: 360, maxHeight: '80vh',
    background: '#0d1526',
    border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    zIndex: 9990, display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(148,163,184,0.08)',
    background: 'rgba(255,255,255,0.02)',
    gap: 10,
  },
  panelHeaderLeft:  { display: 'flex', alignItems: 'center', gap: 10, color: '#4ade80', flex: 1, overflow: 'hidden' },
  panelHeaderRight: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  panelTitle: { fontSize: 13, fontWeight: 700, color: '#f0f4ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  panelSub:   { fontSize: 11, color: '#475569', marginTop: 1 },
  statusLive:    { fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 },
  statusWaiting: { fontSize: 11, color: '#94a3b8' },
  statusStale:   { fontSize: 11, color: '#f59e0b' },
  panelMinimize: {
    background: 'none', border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 6, color: '#64748b', fontSize: 16,
    cursor: 'pointer', width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panelClose: {
    padding: '4px 10px', borderRadius: 6,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.08)', color: '#f87171',
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },

  panelWaiting: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    padding: '40px 24px', color: '#64748b', fontSize: 14,
  },
  waitingSpinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid rgba(34,197,94,0.15)',
    borderTop: '3px solid #22c55e',
    animation: 'ssSpin 0.8s linear infinite',
  },

  panelContent:  { overflowY: 'auto', flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  healthBar:     { display: 'flex', justifyContent: 'flex-end' },
  healthOk:      { fontSize: 11, color: '#4ade80' },
  healthStale:   { fontSize: 11, color: '#f59e0b' },

  section: {
    borderRadius: 8,
    border: '1px solid rgba(148,163,184,0.08)',
    background: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#64748b',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.06)',
    background: 'rgba(255,255,255,0.01)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  sectionBody: { padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 },

  dataRow:   { display: 'flex', gap: 8, alignItems: 'flex-start' },
  dataLabel: { fontSize: 11, color: '#475569', width: 60, flexShrink: 0, paddingTop: 1 },
  dataValue: { fontSize: 12, color: '#94a3b8', flex: 1, wordBreak: 'break-all' },
  mono:      { fontFamily: 'monospace', fontSize: 11, color: '#4ade80' },

  panelTimestamp: { fontSize: 10, color: '#334155', textAlign: 'center', paddingTop: 4 },
};