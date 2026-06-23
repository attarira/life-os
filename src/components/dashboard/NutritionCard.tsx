'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CardShell } from './CardShell';
import { Meal, listMeals, addMeal, removeMeal } from '@/lib/repos/nutrition';

const EMPTY_DRAFT = { name: '', kcal: '', protein: '', carbs: '', fat: '' };

export function NutritionCard() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    listMeals().then(setMeals).catch(() => {});
  }, []);

  const submitMeal = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload = {
      name,
      kcal: Number(draft.kcal) || 0,
      protein: Number(draft.protein) || 0,
      carbs: Number(draft.carbs) || 0,
      fat: Number(draft.fat) || 0,
    };
    setDraft(EMPTY_DRAFT);
    setExpanded(false);
    const meal = await addMeal(payload).catch(() => null);
    if (meal) setMeals((m) => [...m, meal]);
  };

  const deleteMeal = async (id: string) => {
    setMeals((m) => m.filter((x) => x.id !== id));
    await removeMeal(id).catch(() => {});
  };

  const totals = useMemo(
    () => meals.reduce(
      (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    ),
    [meals]
  );

  return (
    <CardShell index="08" title="Nutrition" right={<span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--op-muted)]">Today</span>}>
      <div className="flex items-baseline gap-2">
        <span className="text-[26px] font-semibold tabular-nums text-[var(--op-text)]">{totals.kcal}</span>
        <span className="text-[12px] text-[var(--op-muted)]">kcal today</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] tabular-nums text-[var(--op-muted)]">
        <span><span className="text-[var(--op-text)]">{totals.protein}g</span> protein</span>
        <span><span className="text-[var(--op-text)]">{totals.carbs}g</span> carbs</span>
        <span><span className="text-[var(--op-text)]">{totals.fat}g</span> fat</span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] pl-3 pr-1.5 py-1.5">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitMeal(); }}
            onFocus={() => setExpanded(true)}
            placeholder='Log a meal — e.g. "chicken, rice, broccoli"'
            className="flex-1 bg-transparent text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
          />
          <input
            value={draft.kcal}
            onChange={(e) => setDraft((d) => ({ ...d, kcal: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitMeal(); }}
            inputMode="numeric"
            placeholder="kcal"
            className="w-12 bg-transparent text-right font-mono text-[12px] tabular-nums text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
          />
          <button onClick={submitMeal} className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--op-border-strong)] text-[var(--op-sub)] hover:text-[var(--op-text)]" aria-label="Add meal">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {expanded && (
          <div className="grid grid-cols-3 gap-2">
            {(['protein', 'carbs', 'fat'] as const).map((macro) => (
              <input
                key={macro}
                value={draft[macro]}
                onChange={(e) => setDraft((d) => ({ ...d, [macro]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitMeal(); }}
                inputMode="numeric"
                placeholder={`${macro[0].toUpperCase()}${macro.slice(1)} g`}
                className="rounded-md border border-[var(--op-border)] bg-[var(--op-inset)] px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-border-strong)] focus:outline-none"
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-[var(--op-border)] pt-2">
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--op-dim)]">Today · {meals.length} {meals.length === 1 ? 'meal' : 'meals'}</p>
        {meals.length === 0 ? (
          <p className="py-2 text-center text-[12px] text-[var(--op-dim)]">No meals logged yet.</p>
        ) : (
          <div className="space-y-1">
            {meals.map((m) => (
              <div key={m.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--op-text)]">{m.name}</span>
                <span className="flex-shrink-0 font-mono text-[11px] tabular-nums text-[var(--op-muted)]">{m.kcal} kcal</span>
                <button
                  onClick={() => deleteMeal(m.id)}
                  className="flex-shrink-0 text-[var(--op-dim)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                  aria-label={`Remove ${m.name}`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
}
