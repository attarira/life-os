'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { LoginScreen } from './LoginScreen';

/**
 * Gates the app behind authentication when Supabase is configured.
 * In local-only mode (no env vars) it renders children directly, preserving
 * the original IndexedDB/localStorage experience.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { configured, session, loading } = useAuth();

  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="op flex min-h-screen items-center justify-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--op-muted)]">Loading…</span>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return <>{children}</>;
}
