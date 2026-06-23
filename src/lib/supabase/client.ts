'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client (singleton).
 *
 * The app is fully client-rendered, so we use the standard supabase-js client
 * with its default localStorage-backed session persistence — no SSR/cookie
 * plumbing needed. RLS scopes every row to the authenticated user, so all
 * queries go straight from the browser with the anon key.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the env vars are present, so callers can fall back to local storage. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
