'use client';

import React, { useMemo, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID, Task } from '@/lib/types';
import { CardShell } from './CardShell';

function areaTitle(task: Task, taskMap: Map<string, Task>): string | null {
  let cursor: Task | undefined = task;
  while (cursor && cursor.parentId !== ROOT_TASK_ID) cursor = taskMap.get(cursor.parentId);
  return cursor && cursor.parentId === ROOT_TASK_ID ? cursor.title : null;
}

// Sample rows shown until the user has real key tasks (mirrors the reference dashboard).
const DEMO_ROWS = [
  { title: 'Push next product update', tag: 'Personal' },
  { title: 'Audit ops dashboard', tag: 'Content' },
  { title: 'Review pricing analysis', tag: 'Business' },
  { title: 'Confirm legal sign-off', tag: 'Business' },
  { title: 'Review compliance checklist', tag: 'Business' },
];

export function TodayKeyCard() {
  const { tasks, navigateTo, selectTask, updateTask } = useTaskContext();
  const [query, setQuery] = useState('');

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const parentIds = useMemo(() => new Set(tasks.map((t) => t.parentId)), [tasks]);

  const keyTasks = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return tasks
      .filter((t) => !parentIds.has(t.id))
      .filter((t) => t.status !== 'COMPLETED' && !t.calendarOnly)
      .filter((t) => t.priority === 'HIGH' || (t.dueDate && t.dueDate <= endOfToday))
      .map((t) => {
        const overdue = Boolean(t.dueDate && t.dueDate < now);
        const dueToday = Boolean(t.dueDate && t.dueDate <= endOfToday && !overdue);
        const score = (overdue ? 4 : 0) + (dueToday ? 2 : 0) + (t.priority === 'HIGH' ? 1 : 0);
        return { task: t, overdue, dueToday, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [tasks, parentIds]);

  const trimmed = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!trimmed) return [];
    return tasks
      .filter((t) => t.parentId !== ROOT_TASK_ID && !t.calendarOnly && t.status !== 'COMPLETED')
      .filter((t) => t.title.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [tasks, trimmed]);

  const openTask = (task: Task) => {
    navigateTo(task.parentId);
    selectTask(task.id);
    setQuery('');
  };

  const isDemo = keyTasks.length === 0;
  const count = isDemo ? DEMO_ROWS.length : keyTasks.length;

  return (
    <CardShell
      index="06"
      title="Today · Key"
      right={!trimmed ? <span className="font-mono text-[11px] tabular-nums text-amber-300">★ {count}</span> : undefined}
    >
      {/* Search */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-1.5 transition-colors focus-within:border-[var(--op-border-strong)]">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-[var(--op-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchResults[0]) openTask(searchResults[0]);
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search tasks…"
          className="flex-1 bg-transparent text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="flex-shrink-0 text-[var(--op-dim)] hover:text-[var(--op-text)]" aria-label="Clear search">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {trimmed ? (
        searchResults.length === 0 ? (
          <p className="py-3 text-[12px] text-[var(--op-dim)]">No matching tasks.</p>
        ) : (
          <div className="space-y-0.5">
            {searchResults.map((task) => {
              const area = areaTitle(task, taskMap);
              return (
                <button
                  key={task.id}
                  onClick={() => openTask(task)}
                  className="group flex w-full items-start gap-2.5 rounded-md px-1 py-2 text-left hover:bg-white/[0.03]"
                >
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-[var(--op-dim)]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[13px] text-[var(--op-text)]">{task.title}</span>
                      {task.priority === 'HIGH' && <span className="flex-shrink-0 text-[10px] text-amber-400">★</span>}
                    </div>
                    {area && <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-sky-400/70">{area}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-0.5">
          {isDemo
            ? DEMO_ROWS.map((row) => (
                <div key={row.title} className="flex items-start gap-2.5 rounded-md px-1 py-2">
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-[5px] border-[1.5px] border-[var(--op-dim)]" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[var(--op-text)]">{row.title}</span>
                    <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-sky-400/70">{row.tag}</span>
                  </div>
                  <span className="mt-0.5 flex-shrink-0 text-[10px] text-amber-400">★</span>
                </div>
              ))
            : keyTasks.map(({ task, overdue, dueToday }) => {
                const area = areaTitle(task, taskMap);
                return (
                  <div key={task.id} className="group flex items-start gap-2.5 rounded-md px-1 py-2 hover:bg-white/[0.03]">
                    <button
                      onClick={() => updateTask(task.id, { status: 'COMPLETED' })}
                      className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-[var(--op-dim)] transition-colors hover:border-[var(--op-accent)]"
                      aria-label={`Complete ${task.title}`}
                    />
                    <button onClick={() => { navigateTo(task.parentId); selectTask(task.id); }} className="min-w-0 flex-1 text-left">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] text-[var(--op-text)]">{task.title}</span>
                        {task.priority === 'HIGH' && <span className="flex-shrink-0 text-[10px] text-amber-400">★</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {area && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-sky-400/70">{area}</span>}
                        {overdue && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-rose-300">Overdue</span>}
                        {dueToday && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-amber-300">Today</span>}
                      </div>
                    </button>
                  </div>
                );
              })}
        </div>
      )}
    </CardShell>
  );
}
