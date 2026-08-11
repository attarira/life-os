import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, generateId } from '../utils';

const BIRTHDAYS_STORAGE_KEY = 'lifeos:birthdays:v1';

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

/** Lists birthdays, seeding the defaults on first use. */
export async function listBirthdays(): Promise<BirthdayItem[]> {
  if (!isSupabaseConfigured) {
    const stored = storage.get<BirthdayItem[]>(BIRTHDAYS_STORAGE_KEY, []);
    if (stored.length) return stored;
    const seeded = DEFAULT_BIRTHDAYS.map((b) => ({ id: generateId(), ...b }));
    storage.set(BIRTHDAYS_STORAGE_KEY, seeded);
    return seeded;
  }
  const sb = getSupabase();
  const { data, error } = await sb.from('birthdays').select('id, name, month_day').order('month_day', { ascending: true });
  if (error) throw error;
  if ((data as BirthdayRow[]).length > 0) {
    return (data as BirthdayRow[]).map((r) => ({ id: r.id, name: r.name, date: r.month_day }));
  }
  const payload = DEFAULT_BIRTHDAYS.map((b) => ({ name: b.name, month_day: b.date }));
  const { data: inserted, error: insErr } = await sb.from('birthdays').insert(payload).select('id, name, month_day');
  if (insErr) throw insErr;
  return (inserted as BirthdayRow[]).map((r) => ({ id: r.id, name: r.name, date: r.month_day }));
}

/** Replaces the whole birthday collection (the modal edits the full list). */
export async function replaceBirthdays(items: BirthdayItem[]): Promise<void> {
  if (!isSupabaseConfigured) {
    storage.set(BIRTHDAYS_STORAGE_KEY, items);
    return;
  }
  const sb = getSupabase();
  const { error: delErr } = await sb.from('birthdays').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) throw delErr;
  if (items.length === 0) return;
  const { error } = await sb.from('birthdays').insert(items.map((b) => ({ id: b.id, name: b.name, month_day: b.date })));
  if (error) throw error;
}
