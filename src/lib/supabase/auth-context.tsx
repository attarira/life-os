'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './client';

type AuthValue = {
  /** True when Supabase env is present; when false the app runs in local-only mode. */
  configured: boolean;
  session: Session | null;
  user: User | null;
  loading: boolean;
  authError: string | null;
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
const AUTH_CHECK_TIMEOUT_MS = 15000;

function getAuthFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message === 'Failed to fetch'
      ? 'Could not reach Supabase. If the project was paused, wait for it to finish resuming and try again.'
      : error.message;
  }
  return 'Could not reach Supabase. Check your connection and try again.';
}

function withSessionTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | { data: { session: Session | null } }> {
  return Promise.race([
    promise,
    new Promise<{ data: { session: Session | null } }>((resolve) => {
      window.setTimeout(() => {
        resolve({ data: { session: null } });
      }, timeoutMs);
    }),
  ]);
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Only "loading" when we actually need to resolve a Supabase session.
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();

    withSessionTimeout(supabase.auth.getSession(), AUTH_CHECK_TIMEOUT_MS)
      .then((result) => {
        const sessionData = 'data' in result ? result.data : null;
        setSession(sessionData?.session ?? null);
        if (!sessionData?.session) {
          setAuthError('Supabase is taking too long to respond. You can still continue with the magic link flow.');
        } else {
          setAuthError(null);
        }
      })
      .catch((error) => {
        setAuthError(getAuthFetchErrorMessage(error));
      })
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthError(null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithOtp = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase is not configured.' };
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      const message = error?.message ?? null;
      setAuthError(message);
      return { error: message };
    } catch (error) {
      const message = getAuthFetchErrorMessage(error);
      setAuthError(message);
      return { error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        configured: isSupabaseConfigured,
        session,
        user: session?.user ?? null,
        loading,
        authError,
        signInWithOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
