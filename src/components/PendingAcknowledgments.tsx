'use client';
// src/components/PendingAcknowledgments.tsx
import React, { useEffect, useState } from 'react';

interface Log { id: string; description: string; createdAt: string; user: { name: string | null; email: string }; }

export default function PendingAcknowledgments() {
  const [logs, setLogs]     = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      const res = await fetch('/api/daily-logs/pending-actions');
      const data = await res.json();
      setLogs(data.pending || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchPending(); }, []);

  const respond = async (logId: string, action: 'CONFIRM' | 'DISPUTE') => {
    const note = action === 'DISPUTE' ? prompt('Reason for dispute (optional):') : undefined;
    await fetch(`/api/daily-logs/${logId}/acknowledge`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    fetchPending();
  };

  if (loading) return null;
  if (logs.length === 0) return null;

  return (
    <div style={{ marginBottom: 24, padding: 16, borderRadius: 12, border: '1px solid rgba(234,179,8,0.2)', background: 'rgba(234,179,8,0.04)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#a16207', marginBottom: 12 }}>
        ⏳ {logs.length} Log{logs.length > 1 ? 's' : ''} Pending Your Review
      </div>
      {logs.map(log => (
        <div key={log.id} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{log.description}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {log.user.name || log.user.email} · {new Date(log.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => respond(log.id, 'CONFIRM')}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Confirm
            </button>
            <button onClick={() => respond(log.id, 'DISPUTE')}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✗ Dispute
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
