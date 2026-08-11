import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage } from '../utils';

/**
 * Generic per-user key/value settings.
 * Supabase: a row in `user_settings` (value is jsonb). Local fallback: a
 * dedicated localStorage key so existing local-mode data keeps working.
 */
export async function getSetting<T>(supabaseKey: string, localKey: string, fallback: T): Promise<T> {
  if (!isSupabaseConfigured) return storage.get<T>(localKey, fallback);
  const { data, error } = await getSupabase()
    .from('user_settings').select('value').eq('key', supabaseKey).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? fallback;
}

export async function setSetting<T>(supabaseKey: string, localKey: string, value: T): Promise<void> {
  if (!isSupabaseConfigured) {
    storage.set(localKey, value);
    return;
  }
  const { error } = await getSupabase()
    .from('user_settings').upsert({ key: supabaseKey, value }, { onConflict: 'user_id,key' });
  if (error) throw error;
}
