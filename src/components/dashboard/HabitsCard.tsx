'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CardShell } from './CardShell';
import { HABITS_UPDATED_EVENT } from './OperatorCard';
import { Habit, listHabits, getDoneIds, setHabitDone, addHabit, removeHabit } from '@/lib/repos/habits';

export function HabitsCard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [done, setDone] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    listHabits().then(setHabits).catch(() => {});
    getDoneIds().then(setDone).catch(() => {});
  }, []);

  const toggle = async (id: string) => {
    const wasDone = done.includes(id);
    setDone((d) => (wasDone ? d.filter((h) => h !== id) : [...d, id]));
    window.dispatchEvent(new CustomEvent(HABITS_UPDATED_EVENT));
    await setHabitDone(id, !wasDone).catch(() => {});
  };

  const submitHabit = async () => {
    const name = draft.trim();
    if (!name) return;
    setDraft('');
    setAdding(false);
    const habit = await addHabit(name).catch(() => null);
    if (habit) setHabits((h) => [...h, habit]);
  };

  const deleteHabit = async (id: string) => {
    setHabits((h) => h.filter((x) => x.id !== id));
    setDone((d) => d.filter((x) => x !== id));
    window.dispatchEvent(new CustomEvent(HABITS_UPDATED_EVENT));
    await removeHabit(id).catch(() => {});
  };

  const completed = useMemo(() => habits.filter((h) => done.includes(h.id)).length, [habits, done]);
  const pct = habits.length ? Math.round((completed / habits.length) * 100) : 0;
  const C = 2 * Math.PI * 24;

  return (
    <CardShell
      index="03"
      title="Habits"
      right={<span className="font-mono text-[10px] tabular-nums text-[var(--op-muted)]">{completed}/{habits.length} · {pct}%</span>}
    >
      <div className="flex items-center gap-4 pb-4">
        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
          <svg width={56} height={56} viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="3" />
            <circle
              cx="28" cy="28" r="24" fill="none" stroke="var(--op-accent)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="transition-all duration-500"
            />
          </svg>
          <span className="font-mono text-[15px] font-medium tabular-nums text-[var(--op-text)]">{completed}</span>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-muted)]">Daily score · resets 00:00</p>
          <p className="mt-1 text-[13px] text-[var(--op-sub)]">{completed === 0 ? 'Start with one.' : `${pct}% complete`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {habits.map((habit) => {
          const isDone = done.includes(habit.id);
          return (
            <div
              key={habit.id}
              className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                isDone ? 'border-[var(--op-accent)]/30 bg-[var(--op-accent-dim)]' : 'border-[var(--op-border)] bg-[var(--op-inset)] hover:border-[var(--op-border-strong)]'
              }`}
            >
              <button
                onClick={() => toggle(habit.id)}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all ${
                  isDone ? 'border-[var(--op-accent)] bg-[var(--op-accent)] text-[#05221a]' : 'border-[var(--op-dim)] hover:border-[var(--op-sub)]'
                }`}
                aria-label={`Toggle ${habit.name}`}
              >
                {isDone && (
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button onClick={() => toggle(habit.id)} className="min-w-0 flex-1 text-left">
                <span className={`block truncate text-[13px] ${isDone ? 'text-[var(--op-accent)]' : 'text-[var(--op-text)]'}`}>{habit.name}</span>
                {habit.category && (
                  <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--op-dim)]">{habit.category}</span>
                )}
              </button>
              {habit.target && (
                <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-[var(--op-dim)]">{habit.target}</span>
              )}
              <button
                onClick={() => deleteHabit(habit.id)}
                className="flex-shrink-0 text-[var(--op-dim)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                aria-label={`Remove ${habit.name}`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitHabit(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
            placeholder="New habit…"
            className="flex-1 rounded-md border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-border-strong)] focus:outline-none"
          />
          <button onClick={submitHabit} className="rounded-md border border-[var(--op-border-strong)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--op-sub)] hover:text-[var(--op-text)]">Add</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--op-border)] py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)] transition-colors hover:border-[var(--op-border-strong)] hover:text-[var(--op-sub)]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
          Add habit
        </button>
      )}
    </CardShell>
  );
}
