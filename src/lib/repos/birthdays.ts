import { openDB } from 'idb';
import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, generateId } from '../utils';

const BIRTHDAYS_STORAGE_KEY = 'lifeos:birthdays:v1';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BirthdayItem = {
  id: string;
  name: string;
  date: string; // MM-DD
};

export const DEFAULT_BIRTHDAYS: Array<{ name: string; date: string }> = [
  { name: 'Mom', date: '03-11' },
  { name: 'Dad', date: '12-27' },
  { name: 'Sanaya', date: '12-09' },
  { name: 'Nani', date: '01-18' },
  { name: 'Adi', date: '01-18' },
  { name: 'Amaan', date: '09-15' },
  { name: 'Aamir', date: '11-02' },
  { name: 'Arman', date: '02-21' },
  { name: 'Ilhaam', date: '03-05' },
  { name: 'Abizer', date: '03-07' },
  { name: 'Mehreen', date: '03-07' },
];

type BirthdayRow = { id: string; name: string; month_day: string };

function ensureUUID(id?: string): string {
  if (id && UUID_REGEX.test(id)) return id;
  return generateId();
}

/** Reads birthdays from any local IndexedDB stores. */
async function readFromIndexedDB(): Promise<BirthdayItem[]> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return [];
  const found: BirthdayItem[] = [];

  // Check 'kanban-tasks-db' meta store
  try {
    const db = await openDB('kanban-tasks-db', 1);
    if (db.objectStoreNames.contains('meta')) {
      const meta = await db.get('meta', 'birthdays');
      if (meta && typeof meta === 'object' && Array.isArray((meta as { value?: unknown }).value)) {
        found.push(...((meta as { value: BirthdayItem[] }).value));
      }
      const metaAlt = await db.get('meta', 'lifeos:birthdays:v1');
      if (metaAlt && typeof metaAlt === 'object' && Array.isArray((metaAlt as { value?: unknown }).value)) {
        found.push(...((metaAlt as { value: BirthdayItem[] }).value));
      }
    }
  } catch {}

  // Check any other indexedDB databases that may exist
  try {
    const databases = (await indexedDB.databases?.()) || [];
    for (const dbInfo of databases) {
      if (dbInfo.name && dbInfo.name !== 'kanban-tasks-db') {
        try {
          const db = await openDB(dbInfo.name, dbInfo.version || 1);
          for (const storeName of db.objectStoreNames) {
            if (storeName.toLowerCase().includes('birthday')) {
              const all = await db.getAll(storeName);
              if (Array.isArray(all) && all.length > 0) {
                found.push(
                  ...all.map((item: Record<string, unknown>) => ({
                    id: String(item.id || generateId()),
                    name: String(item.name || item.title || ''),
                    date: String(item.date || item.month_day || item.monthDay || ''),
                  }))
                );
              }
            }
          }
        } catch {}
      }
    }
  } catch {}

  return found.filter((b) => b.name && b.date);
}

/** Reads birthdays from localStorage. */
function readFromLocalStorage(): BirthdayItem[] {
  if (typeof window === 'undefined') return [];
  const items = storage.get<BirthdayItem[]>(BIRTHDAYS_STORAGE_KEY, []);
  if (items && items.length > 0) return items;

  try {
    const raw = localStorage.getItem('birthdays');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((b) => b.name && b.date);
      }
    }
  } catch {}

  return [];
}

/**
 * Migrates birthdays from IndexedDB and localStorage into Supabase's `birthdays` table.
 */
export async function migrateBirthdaysToSupabase(): Promise<{ migrated: number; total: number }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const sb = getSupabase();

  // 1. Gather all candidates from IndexedDB, localStorage, and defaults
  const idbItems = await readFromIndexedDB();
  const localItems = readFromLocalStorage();

  const candidateMap = new Map<string, { name: string; date: string }>();

  DEFAULT_BIRTHDAYS.forEach((b) => candidateMap.set(`${b.name.toLowerCase().trim()}_${b.date.trim()}`, b));

  localItems.forEach((b) => {
    if (b.name && b.date) {
      candidateMap.set(`${b.name.toLowerCase().trim()}_${b.date.trim()}`, { name: b.name.trim(), date: b.date.trim() });
    }
  });

  idbItems.forEach((b) => {
    if (b.name && b.date) {
      candidateMap.set(`${b.name.toLowerCase().trim()}_${b.date.trim()}`, { name: b.name.trim(), date: b.date.trim() });
    }
  });

  // 2. Fetch existing birthdays from Supabase
  const { data: existing, error: fetchErr } = await sb
    .from('birthdays')
    .select('id, name, month_day');

  if (fetchErr) throw fetchErr;

  const existingRows = (existing as BirthdayRow[]) || [];
  const existingKeys = new Set(existingRows.map((r) => `${r.name.toLowerCase().trim()}_${r.month_day.trim()}`));

  // 3. Filter items that need to be inserted into Supabase
  const toInsert: Array<{ id: string; name: string; month_day: string }> = [];
  candidateMap.forEach((item) => {
    const key = `${item.name.toLowerCase().trim()}_${item.date.trim()}`;
    if (!existingKeys.has(key)) {
      toInsert.push({
        id: generateId(),
        name: item.name,
        month_day: item.date,
      });
    }
  });

  // 4. Batch insert into Supabase
  if (toInsert.length > 0) {
    const { error: insErr } = await sb.from('birthdays').insert(toInsert);
    if (insErr) throw insErr;
  }

  return {
    migrated: toInsert.length,
    total: existingRows.length + toInsert.length,
  };
}

/** Lists birthdays, migrating and seeding the defaults on first use. */
export async function listBirthdays(): Promise<BirthdayItem[]> {
  if (!isSupabaseConfigured) {
    const idbItems = await readFromIndexedDB();
    const stored = readFromLocalStorage();
    const combined = stored.length ? stored : idbItems.length ? idbItems : [];
    if (combined.length) {
      return combined.map((b) => ({ id: ensureUUID(b.id), name: b.name, date: b.date }));
    }
    const seeded = DEFAULT_BIRTHDAYS.map((b) => ({ id: generateId(), ...b }));
    storage.set(BIRTHDAYS_STORAGE_KEY, seeded);
    return seeded;
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('birthdays')
    .select('id, name, month_day')
    .order('month_day', { ascending: true });

  if (error) throw error;

  const rows = (data as BirthdayRow[]) || [];
  if (rows.length > 0) {
    // Keep local cache up to date
    storage.set(
      BIRTHDAYS_STORAGE_KEY,
      rows.map((r) => ({ id: r.id, name: r.name, date: r.month_day }))
    );
    return rows.map((r) => ({ id: r.id, name: r.name, date: r.month_day }));
  }

  // If table in Supabase is empty, run migration from local IndexedDB/localStorage
  await migrateBirthdaysToSupabase();

  const { data: refetched, error: refetchErr } = await sb
    .from('birthdays')
    .select('id, name, month_day')
    .order('month_day', { ascending: true });

  if (refetchErr) throw refetchErr;

  const finalRows = (refetched as BirthdayRow[]) || [];
  const result = finalRows.map((r) => ({ id: r.id, name: r.name, date: r.month_day }));
  storage.set(BIRTHDAYS_STORAGE_KEY, result);
  return result;
}

/** Replaces the whole birthday collection in Supabase and local cache. */
export async function replaceBirthdays(items: BirthdayItem[]): Promise<void> {
  const normalized = items.map((b) => ({
    id: ensureUUID(b.id),
    name: b.name.trim(),
    date: b.date.trim(),
  }));

  // Update local cache
  storage.set(BIRTHDAYS_STORAGE_KEY, normalized);

  if (!isSupabaseConfigured) {
    return;
  }

  const sb = getSupabase();
  const { error: delErr } = await sb
    .from('birthdays')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (delErr) throw delErr;
  if (normalized.length === 0) return;

  const payload = normalized.map((b) => ({
    id: b.id,
    name: b.name,
    month_day: b.date,
  }));

  const { error } = await sb.from('birthdays').insert(payload);
  if (error) throw error;
}
