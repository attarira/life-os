import { isSupabaseConfigured, getSupabase } from '../supabase/client';
import { storage, generateId } from '../utils';

export type SubscriptionCategory = 'entertainment' | 'utilities' | 'productivity' | 'health' | 'other';

export type Subscription = {
  id: string;
  name: string;
  cost: number;
  billing: 'monthly' | 'yearly';
  active: boolean;
  category: SubscriptionCategory;
  paymentMethod?: string;
  dueDate?: string;
};

const LOCAL_KEY = 'lifeos:finance:subscriptions:v1';

type SubscriptionRow = {
  id: string;
  name: string;
  cost: number;
  billing: 'monthly' | 'yearly';
  active: boolean;
  category: SubscriptionCategory;
  payment_method: string | null;
  due_date: string | null;
};

function rowToSub(r: SubscriptionRow): Subscription {
  return {
    id: r.id,
    name: r.name,
    cost: Number(r.cost),
    billing: r.billing,
    active: r.active,
    category: r.category,
    paymentMethod: r.payment_method ?? undefined,
    dueDate: r.due_date ?? undefined,
  };
}

export async function listSubscriptions(): Promise<Subscription[]> {
  if (!isSupabaseConfigured) return storage.get<Subscription[]>(LOCAL_KEY, []);
  const { data, error } = await getSupabase()
    .from('subscriptions').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data as SubscriptionRow[]).map(rowToSub);
}

export async function addSubscription(input: Omit<Subscription, 'id'>): Promise<Subscription> {
  if (!isSupabaseConfigured) {
    const subs = storage.get<Subscription[]>(LOCAL_KEY, []);
    const sub = { id: generateId(), ...input };
    storage.set(LOCAL_KEY, [sub, ...subs]);
    return sub;
  }
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .insert({
      name: input.name, cost: input.cost, billing: input.billing, active: input.active,
      category: input.category, payment_method: input.paymentMethod ?? null, due_date: input.dueDate ?? null,
    })
    .select('*').single();
  if (error) throw error;
  return rowToSub(data as SubscriptionRow);
}

export async function updateSubscription(id: string, patch: Partial<Omit<Subscription, 'id'>>): Promise<void> {
  if (!isSupabaseConfigured) {
    const subs = storage.get<Subscription[]>(LOCAL_KEY, []);
    storage.set(LOCAL_KEY, subs.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    return;
  }
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.cost !== undefined) row.cost = patch.cost;
  if (patch.billing !== undefined) row.billing = patch.billing;
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod ?? null;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate ?? null;
  const { error } = await getSupabase().from('subscriptions').update(row).eq('id', id);
  if (error) throw error;
}

export async function removeSubscription(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const subs = storage.get<Subscription[]>(LOCAL_KEY, []);
    storage.set(LOCAL_KEY, subs.filter((s) => s.id !== id));
    return;
  }
  const { error } = await getSupabase().from('subscriptions').delete().eq('id', id);
  if (error) throw error;
}
