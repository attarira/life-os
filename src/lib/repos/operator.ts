import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage } from '../utils';
import { OPERATOR_PROFILE_STORAGE_KEY } from '../storage-keys';

export type OperatorProfile = { name: string; role: string; location: string; focus: string };

const SETTING_KEY = 'operator_profile';

export async function getOperatorProfile(fallback: OperatorProfile): Promise<OperatorProfile> {
  if (!isSupabaseConfigured) return storage.get<OperatorProfile>(OPERATOR_PROFILE_STORAGE_KEY, fallback);
  const { data, error } = await getSupabase()
    .from('user_settings').select('value').eq('key', SETTING_KEY).maybeSingle();
  if (error) throw error;
  return (data?.value as OperatorProfile) ?? fallback;
}

export async function saveOperatorProfile(profile: OperatorProfile): Promise<void> {
  if (!isSupabaseConfigured) {
    storage.set(OPERATOR_PROFILE_STORAGE_KEY, profile);
    return;
  }
  const { error } = await getSupabase()
    .from('user_settings').upsert({ key: SETTING_KEY, value: profile }, { onConflict: 'user_id,key' });
  if (error) throw error;
}
