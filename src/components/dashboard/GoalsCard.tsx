'use client';

import React, { useEffect, useState } from 'react';
import { weekKey, monthKey } from '@/lib/utils';
import { CardShell } from './CardShell';
import { Goal, GoalPeriod, listGoals, addGoal, toggleGoal, removeGoal } from '@/lib/repos/goals';

export function GoalsCard() {
  const wk = weekKey();
  const mk = monthKey();

  const [weekly, setWeekly] = useState<Goal[]>([]);
  const [monthly, setMonthly] = useState<Goal[]>([]);
  const [weekDraft, setWeekDraft] = useState('');
  const [monthDraft, setMonthDraft] = useState('');

  useEffect(() => {
    listGoals('week', wk).then(setWeekly).catch(() => {});
    listGoals('month', mk).then(setMonthly).catch(() => {});
  }, [wk, mk]);

  const renderSection = (
    period: GoalPeriod,
    periodKey: string,
    label: string,
    placeholder: string,
    goals: Goal[],
    setGoals: React.Dispatch<React.SetStateAction<Goal[]>>,
    draft: string,
    setDraft: (v: string) => void
  ) => {
    const add = async () => {
      const text = draft.trim();
      if (!text) return;
      setDraft('');
      const goal = await addGoal(period, periodKey, text, goals.length).catch(() => null);
      if (goal) setGoals((g) => [...g, goal]);
    };
    const toggle = async (id: string, done: boolean) => {
      setGoals((g) => g.map((x) => (x.id === id ? { ...x, done } : x)));
      await toggleGoal(period, periodKey, id, done).catch(() => {});
    };
    const remove = async (id: string) => {
      setGoals((g) => g.filter((x) => x.id !== id));
      await removeGoal(period, periodKey, id).catch(() => {});
    };
    return (
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">{label}</p>
        <div className="mt-2 space-y-1.5">
          {goals.map((g) => (
            <div key={g.id} className="group flex items-center gap-2.5">
              <button
                onClick={() => toggle(g.id, !g.done)}
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
                onClick={() => remove(g.id)}
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
      {renderSection('week', wk, 'This week', 'Add a weekly goal', weekly, setWeekly, weekDraft, setWeekDraft)}
      {renderSection('month', mk, 'This month', 'Add a monthly goal', monthly, setMonthly, monthDraft, setMonthDraft)}
    </CardShell>
  );
}
