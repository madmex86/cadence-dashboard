'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from '../login/login.module.css';

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase exchanges the invite token from the URL hash client-side.
    // Give it a moment, then check for an active session.
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className={styles.screen}>
      <div className={styles.box}>
        <div className={styles.crownWrap}>
          <svg className={styles.crown} width="64" height="50" viewBox="0 -2 76 52" fill="none">
            <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="4" y="42" width="64" height="3" rx="1.5" fill="#C9A84C" />
            <circle cx="36" cy="4" r="5.5" fill="#E8D08A" />
            <circle cx="6" cy="18" r="4" fill="#5BBFD4" />
            <circle cx="66" cy="18" r="4" fill="#5BBFD4" />
          </svg>
        </div>
        <div className={styles.brand}>
          <span className={styles.brandName}>Cadence Creatures</span>
        </div>
        <p className={styles.sub}>Set Your Password</p>

        {!ready ? (
          <p style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', marginTop: 8 }}>
            {error || 'Verifying your invite link…'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">New Password</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </form>
        )}

        {!ready && !error && (
          <p style={{ fontSize: 11, color: 'rgba(196,188,178,0.4)', textAlign: 'center', marginTop: 16 }}>
            If this page keeps loading, your invite link may have expired.{' '}
            Ask your admin to resend the invite.
          </p>
        )}
      </div>
    </div>
  );
}
