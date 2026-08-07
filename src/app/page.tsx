'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/auth/login');  // ? Changed from /login to /auth/login
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--bg-page)',
      color: 'var(--text-muted)'
    }}>
      <p>Redirecting to login...</p>
    </div>
  );
}
