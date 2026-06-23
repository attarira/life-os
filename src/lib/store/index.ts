import { indexedDBStore } from './indexeddb-store';
import { supabaseTaskStore } from './supabase-store';
import { isSupabaseConfigured } from '../supabase/client';
import { TaskStore } from '../types';

/**
 * Active task store.
 *
 * Uses Supabase when env vars are present, otherwise falls back to the local
 * IndexedDB store. Note: the Supabase path requires an authenticated session
 * (RLS scopes every row to auth.uid()), so the auth gate must be in place
 * before queries will return data.
 */
export const taskStore: TaskStore = isSupabaseConfigured ? supabaseTaskStore : indexedDBStore;

export { indexedDBStore } from './indexeddb-store';
export { supabaseTaskStore } from './supabase-store';
