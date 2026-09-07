'use client';
// src/components/SearchableStaffPicker.tsx
import React, { useState, useEffect, useRef } from 'react';

interface Staff { id: string; name: string | null; email: string; role: string; }
interface Props { value: string; onChange: (userId: string, user: Staff | null) => void; placeholder?: string; }

export default function SearchableStaffPicker({ value, onChange, placeholder = 'Search staff…' }: Props) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Staff[]>([]);
  const [open, setOpen]       = useState(false);
  const [selected, setSelected] = useState<Staff | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
        const data = await res.json();
        setResults(data.users || []);
      } catch {}
    }, 300);
  }, [query]);

  const pick = (user: Staff) => {
    setSelected(user); setQuery(user.name || user.email);
    setOpen(false); onChange(user.id, user);
  };

  const clear = () => { setSelected(null); setQuery(''); onChange('', null); };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) clear(); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14 }}
        />
        {selected && <button onClick={clear} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', marginTop: 4, overflow: 'hidden' }}>
          {results.map(u => (
            <button key={u.id} onClick={() => pick(u)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {(u.name || u.email)[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name || '(No name)'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email} · {u.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
