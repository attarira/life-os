import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, dayKey } from '../utils';
import { NETWORTH_STORAGE_KEY } from '../storage-keys';

export type NetWorthPoint = { date: string; value: number };
type LocalStore = { history: NetWorthPoint[] };

type SnapshotRow = { snapshot_date: string; assets: number; liabilities: number };

/** Ascending series of { date, value } where value = assets - liabilities. */
export async function getNetWorthSeries(): Promise<NetWorthPoint[]> {
  if (!isSupabaseConfigured) {
    return storage.get<LocalStore>(NETWORTH_STORAGE_KEY, { history: [] }).history;
  }
  const { data, error } = await getSupabase()
    .from('net_worth_snapshots').select('snapshot_date, assets, liabilities')
    .order('snapshot_date', { ascending: true });
  if (error) throw error;
  return (data as SnapshotRow[]).map((r) => ({ date: r.snapshot_date, value: Number(r.assets) - Number(r.liabilities) }));
}

/** Upserts today's net worth (stored as assets = value, liabilities = 0). */
export async function setNetWorthToday(value: number): Promise<void> {
  const today = dayKey();
  if (!isSupabaseConfigured) {
    const store = storage.get<LocalStore>(NETWORTH_STORAGE_KEY, { history: [] });
    const history = store.history.filter((p) => p.date !== today);
    history.push({ date: today, value });
    history.sort((a, b) => a.date.localeCompare(b.date));
    storage.set(NETWORTH_STORAGE_KEY, { history });
    return;
  }
  const { error } = await getSupabase()
    .from('net_worth_snapshots')
    .upsert({ snapshot_date: today, assets: value, liabilities: 0 }, { onConflict: 'user_id,snapshot_date' });
  if (error) throw error;
}
