'use client';

import { useEffect, useState } from 'react';

interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  sessionId: string;
  session: {
    requester: { name: string | null; email: string };
    target: { name: string | null; email: string };
  };
}

const actionColor: Record<string, string> = {
  REQUESTED: '#60a5fa',
  ACCEPTED: '#4ade80',
  REJECTED: '#f87171',
  ENDED_BY_REQUESTER: '#94a3b8',
  ENDED_BY_TARGET: '#94a3b8',
};

export default function ScreenShareAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/screenshare/audit')
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto', color: '#f0f4ff', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Screen Share Audit Log</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>Immutable record of all screen share activity.</p>

      {loading ? (
        <p style={{ color: '#475569' }}>Loading...</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#475569', textAlign: 'center', padding: '40px 0' }}>No screen share sessions recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map((log) => (
            <div key={log.id} style={{
              display: 'grid', gridTemplateColumns: '160px 140px 1fr',
              gap: 12, alignItems: 'center', padding: '12px 16px',
              borderRadius: 8, background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(148,163,184,0.08)', fontSize: 13,
            }}>
              <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 11 }}>
                {new Date(log.createdAt).toLocaleString()}
              </span>
              <span style={{ color: actionColor[log.action] || '#94a3b8', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>
                {log.action}
              </span>
              <span style={{ color: '#94a3b8' }}>
                <strong style={{ color: '#f0f4ff' }}>{log.session.requester.name || log.session.requester.email}</strong>
                {' → '}
                <strong style={{ color: '#f0f4ff' }}>{log.session.target.name || log.session.target.email}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
