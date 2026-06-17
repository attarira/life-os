'use client';

import React, { useState } from 'react';
import { storage, weekKey, monthKey, generateId } from '@/lib/utils';
import { GOALS_STORAGE_KEY } from '@/lib/storage-keys';
import { CardShell } from './CardShell';

type Goal = { id: string; text: string; done: boolean };
type GoalsStore = { week: string; weekly: Goal[]; month: string; monthly: Goal[] };

export function GoalsCard() {
  const [weekly, setWeekly] = useState<Goal[]>(() => {
    const stored = storage.get<GoalsStore>(GOALS_STORAGE_KEY, { week: '', weekly: [], month: '', monthly: [] });
    return stored.week === weekKey() ? stored.weekly : [];
  });
  const [monthly, setMonthly] = useState<Goal[]>(() => {
    const stored = storage.get<GoalsStore>(GOALS_STORAGE_KEY, { week: '', weekly: [], month: '', monthly: [] });
    return stored.month === monthKey() ? stored.monthly : [];
  });
  const [weekDraft, setWeekDraft] = useState('');
  const [monthDraft, setMonthDraft] = useState('');

  const persist = (nextWeekly: Goal[], nextMonthly: Goal[]) => {
    setWeekly(nextWeekly);
    setMonthly(nextMonthly);
    storage.set(GOALS_STORAGE_KEY, { week: weekKey(), weekly: nextWeekly, month: monthKey(), monthly: nextMonthly });
  };

  const renderSection = (
    label: string,
    placeholder: string,
    goals: Goal[],
    draft: string,
    setDraft: (v: string) => void,
    update: (next: Goal[]) => void
  ) => {
    const add = () => {
      const text = draft.trim();
      if (!text) return;
      update([...goals, { id: generateId(), text, done: false }]);
      setDraft('');
    };
    return (
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">{label}</p>
        <div className="mt-2 space-y-1.5">
          {goals.map((g) => (
            <div key={g.id} className="group flex items-center gap-2.5">
              <button
                onClick={() => update(goals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all ${
                  g.done ? 'border-[var(--op-accent)] bg-[var(--op-accent)] text-[#05221a]' : 'border-[var(--op-dim)] hover:border-[var(--op-sub)]'
                }`}
              >
                {g.done && (
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={`min-w-0 flex-1 truncate text-[13px] ${g.done ? 'text-[var(--op-dim)] line-through' : 'text-[var(--op-text)]'}`}>{g.text}</span>
              <button
                onClick={() => update(goals.filter((x) => x.id !== g.id))}
                className="flex-shrink-0 text-[var(--op-dim)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                aria-label="Remove goal"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] pl-3 pr-1.5 py-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
            />
            <button onClick={add} className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--op-border-strong)] text-[var(--op-sub)] hover:text-[var(--op-text)]" aria-label={`Add ${label}`}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <CardShell index="09" title="Goals" bodyClassName="space-y-4">
      {renderSection('This week', 'Add a weekly goal', weekly, weekDraft, setWeekDraft, (next) => persist(next, monthly))}
      {renderSection('This month', 'Add a monthly goal', monthly, monthDraft, setMonthDraft, (next) => persist(weekly, next))}
    </CardShell>
  );
}
