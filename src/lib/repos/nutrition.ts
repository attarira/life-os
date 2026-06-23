import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, dayKey, generateId } from '../utils';

export type Meal = { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number };

const localKey = (date: string) => `lifeos:nutrition:${date}`;

export async function listMeals(date = dayKey()): Promise<Meal[]> {
  if (!isSupabaseConfigured) return storage.get<Meal[]>(localKey(date), []);
  const { data, error } = await getSupabase()
    .from('meals').select('id, name, kcal, protein, carbs, fat')
    .eq('meal_date', date).order('created_at', { ascending: true });
  if (error) throw error;
  return data as Meal[];
}

export async function addMeal(meal: Omit<Meal, 'id'>, date = dayKey()): Promise<Meal> {
  if (!isSupabaseConfigured) {
    const meals = storage.get<Meal[]>(localKey(date), []);
    const next = { id: generateId(), ...meal };
    storage.set(localKey(date), [...meals, next]);
    return next;
  }
  const { data, error } = await getSupabase()
    .from('meals').insert({ meal_date: date, ...meal })
    .select('id, name, kcal, protein, carbs, fat').single();
  if (error) throw error;
  return data as Meal;
}

export async function removeMeal(id: string, date = dayKey()): Promise<void> {
  if (!isSupabaseConfigured) {
    const meals = storage.get<Meal[]>(localKey(date), []);
    storage.set(localKey(date), meals.filter((m) => m.id !== id));
    return;
  }
  const { error } = await getSupabase().from('meals').delete().eq('id', id);
  if (error) throw error;
}
