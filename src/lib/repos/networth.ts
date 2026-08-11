import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, dayKey } from '../utils';
import { NETWORTH_STORAGE_KEY } from '../storage-keys';

export type NetWorthSnapshot = { date: string; assets: number; liabilities: number };
export type NetWorthPoint = { date: string; value: number };
type LocalStore = { snapshots: NetWorthSnapshot[] };

type SnapshotRow = { snapshot_date: string; assets: number; liabilities: number };

function readLocal(): NetWorthSnapshot[] {
  return storage.get<LocalStore>(NETWORTH_STORAGE_KEY, { snapshots: [] }).snapshots;
}

/** All snapshots, newest first. */
export async function getNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
  if (!isSupabaseConfigured) {
    return [...readLocal()].sort((a, b) => b.date.localeCompare(a.date));
  }
  const { data, error } = await getSupabase()
    .from('net_worth_snapshots').select('snapshot_date, assets, liabilities')
    .order('snapshot_date', { ascending: false });
  if (error) throw error;
  return (data as SnapshotRow[]).map((r) => ({ date: r.snapshot_date, assets: Number(r.assets), liabilities: Number(r.liabilities) }));
}

/** Ascending { date, value } series (value = assets − liabilities) for the dashboard sparkline. */
export async function getNetWorthSeries(): Promise<NetWorthPoint[]> {
  const snaps = await getNetWorthSnapshots();
  return [...snaps]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, value: s.assets - s.liabilities }));
}

/** Upserts today's snapshot (one row per day). */
export async function snapshotNetWorth(assets: number, liabilities: number): Promise<void> {
  const today = dayKey();
  if (!isSupabaseConfigured) {
    const snapshots = readLocal().filter((s) => s.date !== today);
    snapshots.push({ date: today, assets, liabilities });
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    storage.set(NETWORTH_STORAGE_KEY, { snapshots });
    return;
  }
  const { error } = await getSupabase()
    .from('net_worth_snapshots')
    .upsert({ snapshot_date: today, assets, liabilities }, { onConflict: 'user_id,snapshot_date' });
  if (error) throw error;
}
