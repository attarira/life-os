import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, generateId } from '../utils';

export type GoalPeriod = 'week' | 'month';
export type Goal = { id: string; text: string; done: boolean };

type GoalRow = { id: string; text: string; done: boolean };

// Local mode: one storage slot per (period, periodKey) so rollover = empty list.
const localKey = (period: GoalPeriod, periodKey: string) => `lifeos:goals:${period}:${periodKey}`;

export async function listGoals(period: GoalPeriod, periodKey: string): Promise<Goal[]> {
  if (!isSupabaseConfigured) return storage.get<Goal[]>(localKey(period, periodKey), []);
  const { data, error } = await getSupabase()
    .from('goals').select('id, text, done')
    .eq('period', period).eq('period_key', periodKey)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data as GoalRow[];
}

export async function addGoal(period: GoalPeriod, periodKey: string, text: string, sortOrder: number): Promise<Goal> {
  if (!isSupabaseConfigured) {
    const goals = storage.get<Goal[]>(localKey(period, periodKey), []);
    const goal = { id: generateId(), text, done: false };
    storage.set(localKey(period, periodKey), [...goals, goal]);
    return goal;
  }
  const { data, error } = await getSupabase()
    .from('goals').insert({ period, period_key: periodKey, text, sort_order: sortOrder })
    .select('id, text, done').single();
  if (error) throw error;
  return data as GoalRow;
}

export async function toggleGoal(period: GoalPeriod, periodKey: string, id: string, done: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const goals = storage.get<Goal[]>(localKey(period, periodKey), []);
    storage.set(localKey(period, periodKey), goals.map((g) => (g.id === id ? { ...g, done } : g)));
    return;
  }
  const { error } = await getSupabase().from('goals').update({ done }).eq('id', id);
  if (error) throw error;
}

export async function removeGoal(period: GoalPeriod, periodKey: string, id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const goals = storage.get<Goal[]>(localKey(period, periodKey), []);
    storage.set(localKey(period, periodKey), goals.filter((g) => g.id !== id));
    return;
  }
  const { error } = await getSupabase().from('goals').delete().eq('id', id);
  if (error) throw error;
}
