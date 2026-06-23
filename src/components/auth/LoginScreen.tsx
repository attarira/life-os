'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';

export function LoginScreen() {
  const { signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setError('');
    const { error } = await signInWithOtp(email);
    if (error) {
      setStatus('error');
      setError(error);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="op flex min-h-screen items-center justify-center px-4 text-[var(--op-text)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--op-accent)] shadow-[0_0_8px_var(--op-accent)]" />
          <span className="text-[13px] font-semibold tracking-[0.16em] text-[var(--op-text)]">LIFE OS</span>
          <span className="font-mono text-[10px] tracking-wider text-[var(--op-dim)]">{'// V0'}</span>
        </div>

        <div className="rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] p-6 backdrop-blur-sm">
          {status === 'sent' ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--op-accent)]/30 bg-[var(--op-accent-dim)] text-[var(--op-accent)]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </div>
              <h1 className="op-serif text-xl text-[var(--op-text)]">Check your email</h1>
              <p className="mt-2 text-[13px] text-[var(--op-muted)]">
                We sent a magic sign-in link to <span className="text-[var(--op-text)]">{email}</span>. Open it on this device to continue.
              </p>
              <button
                onClick={() => { setStatus('idle'); setEmail(''); }}
                className="mt-4 font-mono text-[11px] uppercase tracking-wider text-[var(--op-muted)] hover:text-[var(--op-text)]"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="op-serif text-2xl text-[var(--op-text)]">Sign in</h1>
              <p className="mt-1.5 text-[13px] text-[var(--op-muted)]">
                Enter your email and we&apos;ll send you a magic link — no password needed.
              </p>
              <form onSubmit={submit} className="mt-5 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                  className="w-full rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2.5 text-[14px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-border-strong)] focus:outline-none"
                />
                {status === 'error' && <p className="text-[12px] text-rose-400">{error}</p>}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full rounded-lg bg-[var(--op-accent)] px-3 py-2.5 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[#05221a] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {status === 'sending' ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
