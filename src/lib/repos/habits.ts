import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, dayKey, generateId } from '../utils';
import { HABITS_DEFS_STORAGE_KEY, HABITS_LOG_STORAGE_KEY } from '../storage-keys';

export type Habit = { id: string; name: string; category?: string; target?: string };
type HabitLog = Record<string, string[]>; // local mode: { [dateKey]: completedHabitId[] }

// Default set mirrors the operator dashboard reference (categories/targets are sample data).
export const DEFAULT_HABITS: Omit<Habit, 'id'>[] = [
  { name: 'Gym', category: 'Fitness' },
  { name: 'Supplements', category: 'Health', target: '0/3' },
  { name: 'Creative session', category: 'Output', target: '0/7' },
  { name: 'Community session', category: 'CRM', target: '0/4' },
  { name: 'Finance check', category: 'Ops · 20–30 min', target: '0/5' },
  { name: 'Wind-down session', category: 'Evening', target: '0/4' },
];

type HabitRow = { id: string; name: string; category: string | null; target: string | null };

function rowToHabit(r: HabitRow): Habit {
  return { id: r.id, name: r.name, category: r.category ?? undefined, target: r.target ?? undefined };
}

/** Lists habits, seeding the default set on first use so the card isn't empty. */
export async function listHabits(): Promise<Habit[]> {
  if (!isSupabaseConfigured) {
    const defs = storage.get<Habit[]>(HABITS_DEFS_STORAGE_KEY, []);
    if (defs.length) return defs;
    const seeded = DEFAULT_HABITS.map((h) => ({ id: generateId(), ...h }));
    storage.set(HABITS_DEFS_STORAGE_KEY, seeded);
    return seeded;
  }
  const sb = getSupabase();
  const { data, error } = await sb.from('habits').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  if ((data as HabitRow[]).length > 0) return (data as HabitRow[]).map(rowToHabit);

  const payload = DEFAULT_HABITS.map((h, i) => ({ name: h.name, category: h.category ?? null, target: h.target ?? null, sort_order: i }));
  const { data: inserted, error: insErr } = await sb.from('habits').insert(payload).select('*').order('sort_order', { ascending: true });
  if (insErr) throw insErr;
  return (inserted as HabitRow[]).map(rowToHabit);
}

export async function getDoneIds(date = dayKey()): Promise<string[]> {
  if (!isSupabaseConfigured) {
    const log = storage.get<HabitLog>(HABITS_LOG_STORAGE_KEY, {});
    return log[date] ?? [];
  }
  const { data, error } = await getSupabase().from('habit_logs').select('habit_id').eq('log_date', date);
  if (error) throw error;
  return (data as { habit_id: string }[]).map((r) => r.habit_id);
}

export async function setHabitDone(habitId: string, done: boolean, date = dayKey()): Promise<void> {
  if (!isSupabaseConfigured) {
    const log = storage.get<HabitLog>(HABITS_LOG_STORAGE_KEY, {});
    const cur = new Set(log[date] ?? []);
    if (done) cur.add(habitId); else cur.delete(habitId);
    log[date] = [...cur];
    storage.set(HABITS_LOG_STORAGE_KEY, log);
    return;
  }
  const sb = getSupabase();
  if (done) {
    const { error } = await sb.from('habit_logs').upsert({ habit_id: habitId, log_date: date, completed: true }, { onConflict: 'habit_id,log_date' });
    if (error) throw error;
  } else {
    const { error } = await sb.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', date);
    if (error) throw error;
  }
}

export async function addHabit(name: string): Promise<Habit> {
  if (!isSupabaseConfigured) {
    const defs = storage.get<Habit[]>(HABITS_DEFS_STORAGE_KEY, []);
    const habit = { id: generateId(), name };
    storage.set(HABITS_DEFS_STORAGE_KEY, [...defs, habit]);
    return habit;
  }
  const { data, error } = await getSupabase().from('habits').insert({ name }).select('*').single();
  if (error) throw error;
  return rowToHabit(data as HabitRow);
}

export async function removeHabit(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const defs = storage.get<Habit[]>(HABITS_DEFS_STORAGE_KEY, []);
    storage.set(HABITS_DEFS_STORAGE_KEY, defs.filter((h) => h.id !== id));
    const log = storage.get<HabitLog>(HABITS_LOG_STORAGE_KEY, {});
    for (const d of Object.keys(log)) log[d] = (log[d] ?? []).filter((h) => h !== id);
    storage.set(HABITS_LOG_STORAGE_KEY, log);
    return;
  }
  const { error } = await getSupabase().from('habits').delete().eq('id', id);
  if (error) throw error;
}

/** Consecutive days (ending today or yesterday) with at least one completed habit. */
export async function getStreak(): Promise<number> {
  let activeDates: Set<string>;
  if (!isSupabaseConfigured) {
    const log = storage.get<HabitLog>(HABITS_LOG_STORAGE_KEY, {});
    activeDates = new Set(Object.entries(log).filter(([, ids]) => ids.length > 0).map(([d]) => d));
  } else {
    const { data, error } = await getSupabase().from('habit_logs').select('log_date').eq('completed', true);
    if (error) throw error;
    activeDates = new Set((data as { log_date: string }[]).map((r) => r.log_date));
  }
  let streak = 0;
  const cursor = new Date();
  if (!activeDates.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
