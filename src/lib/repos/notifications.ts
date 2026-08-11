import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage } from '../utils';
import { NOTIFICATIONS_STORAGE_KEY } from '../storage-keys';
import { Notification } from '../types';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: Notification['type'];
  read: boolean;
  related_task_id: string | null;
  created_at: string;
};

function rowToNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.read,
    createdAt: new Date(r.created_at),
    relatedTaskId: r.related_task_id ?? undefined,
  };
}

function readLocal(): Notification[] {
  return storage
    .get<Array<Omit<Notification, 'createdAt'> & { createdAt: string }>>(NOTIFICATIONS_STORAGE_KEY, [])
    .map((n) => ({ ...n, createdAt: new Date(n.createdAt) }));
}

function writeLocal(items: Notification[]): void {
  storage.set(NOTIFICATIONS_STORAGE_KEY, items);
}

/** Lists notifications (newest first), pruning anything older than the retention window. */
export async function listNotifications(): Promise<Notification[]> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  if (!isSupabaseConfigured) {
    const kept = readLocal().filter((n) => n.createdAt > cutoff);
    writeLocal(kept);
    return kept.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  const sb = getSupabase();
  await sb.from('notifications').delete().lt('created_at', cutoff.toISOString());
  const { data, error } = await sb
    .from('notifications').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as NotificationRow[]).map(rowToNotification);
}

export async function addNotifications(items: Notification[]): Promise<void> {
  if (items.length === 0) return;
  if (!isSupabaseConfigured) {
    writeLocal([...items, ...readLocal()]);
    return;
  }
  const { error } = await getSupabase().from('notifications').insert(
    items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      related_task_id: n.relatedTaskId ?? null,
      created_at: n.createdAt.toISOString(),
    }))
  );
  if (error) throw error;
}

export async function markRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    writeLocal(readLocal().map((n) => (n.id === id ? { ...n, read: true } : n)));
    return;
  }
  const { error } = await getSupabase().from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllRead(): Promise<void> {
  if (!isSupabaseConfigured) {
    writeLocal(readLocal().map((n) => ({ ...n, read: true })));
    return;
  }
  const { error } = await getSupabase().from('notifications').update({ read: true }).eq('read', false);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    writeLocal(readLocal().filter((n) => n.id !== id));
    return;
  }
  const { error } = await getSupabase().from('notifications').delete().eq('id', id);
  if (error) throw error;
}

export async function clearAllNotifications(): Promise<void> {
  if (!isSupabaseConfigured) {
    writeLocal([]);
    return;
  }
  const { error } = await getSupabase().from('notifications').delete().neq('id', IMPOSSIBLE_ID);
  if (error) throw error;
}
