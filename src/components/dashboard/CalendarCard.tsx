'use client';

import React, { useMemo, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID, Task } from '@/lib/types';
import { dayKey } from '@/lib/utils';
import { CardShell } from './CardShell';

type AgendaItem = {
  key: string;
  minutes: number | null;
  time: string | null;
  title: string;
  area: string | null;
  kind: 'scheduled' | 'due' | 'both' | 'demo';
  taskId?: string;
  parentId?: string;
};

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Sample agenda shown for "today" until real scheduled tasks exist.
const DEMO_AGENDA: AgendaItem[] = [
  { key: 'd1', minutes: 600, time: '10:00', title: '1:1 · Sarah K', area: 'Relationships', kind: 'demo' },
  { key: 'd2', minutes: 660, time: '11:00', title: 'Train · push day', area: 'Health', kind: 'demo' },
  { key: 'd3', minutes: 840, time: '14:00', title: 'Deep work', area: 'Career', kind: 'demo' },
  { key: 'd4', minutes: 1140, time: '19:00', title: 'Evening standup', area: 'Career', kind: 'demo' },
];

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function hasTime(date?: Date): boolean {
  return Boolean(date && (date.getHours() !== 0 || date.getMinutes() !== 0));
}

function fmt(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const ACCENT: Record<AgendaItem['kind'], string> = {
  scheduled: 'bg-[var(--op-accent)]',
  due: 'bg-orange-400',
  both: 'bg-fuchsia-400',
  demo: 'bg-[var(--op-accent)]',
};

export function CalendarCard() {
  const { tasks, navigateTo, selectTask } = useTaskContext();
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const parentIds = useMemo(() => new Set(tasks.map((t) => t.parentId)), [tasks]);

  const areaTitle = (task: Task): string | null => {
    let cursor: Task | undefined = task;
    while (cursor && cursor.parentId !== ROOT_TASK_ID) cursor = taskMap.get(cursor.parentId);
    return cursor && cursor.parentId === ROOT_TASK_ID ? cursor.title : null;
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    tasks
      .filter((t) => !parentIds.has(t.id) && t.status !== 'COMPLETED')
      .forEach((t) => {
        const sched = t.scheduledDate ? new Date(t.scheduledDate) : null;
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const days = new Set<string>();
        if (sched) days.add(dayKey(sched));
        if (due) days.add(dayKey(due));
        days.forEach((key) => {
          const onSched = sched && dayKey(sched) === key;
          const onDue = due && dayKey(due) === key;
          const kind: AgendaItem['kind'] = onSched && onDue ? 'both' : onSched ? 'scheduled' : 'due';
          const timeSrc = onSched && hasTime(sched) ? sched : onDue && hasTime(due) ? due : null;
          const list = map.get(key) || [];
          list.push({
            key: `${t.id}-${kind}`,
            minutes: timeSrc ? timeSrc.getHours() * 60 + timeSrc.getMinutes() : null,
            time: timeSrc ? fmt(timeSrc) : null,
            title: t.title,
            area: areaTitle(t),
            kind,
            taskId: t.id,
            parentId: t.parentId,
          });
          map.set(key, list);
        });
      });
    map.forEach((list) => list.sort((a, b) => (a.minutes ?? 1e9) - (b.minutes ?? 1e9)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, parentIds]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const todayKey = dayKey();
  const selectedKey = dayKey(selected);
  const isSelectedToday = selectedKey === todayKey;
  const realEvents = eventsByDay.get(selectedKey) || [];
  const agenda = realEvents.length > 0 ? realEvents : isSelectedToday ? DEMO_AGENDA : [];

  const monthLabel = weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowLabel = fmt(new Date());

  const shiftWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  };

  // Index at which to draw the NOW marker (only for today).
  const nowIndex = isSelectedToday ? agenda.findIndex((e) => (e.minutes ?? 1e9) >= nowMinutes) : -1;

  return (
    <CardShell
      index="04"
      title="Calendar"
      right={
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-wide text-[var(--op-muted)]">{monthLabel}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--op-dim)]">{agenda.length} {agenda.length === 1 ? 'event' : 'events'}</span>
          <div className="flex items-center">
            <button onClick={() => shiftWeek(-1)} className="rounded p-1 text-[var(--op-dim)] hover:bg-white/[0.04] hover:text-[var(--op-text)]" aria-label="Previous week">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => shiftWeek(1)} className="rounded p-1 text-[var(--op-dim)] hover:bg-white/[0.04] hover:text-[var(--op-text)]" aria-label="Next week">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      }
    >
      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const key = dayKey(d);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const count = (eventsByDay.get(key) || []).length || (isToday ? DEMO_AGENDA.length : 0);
          return (
            <button
              key={key}
              onClick={() => setSelected(d)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors ${
                isSelected
                  ? 'border-[var(--op-border-strong)] bg-white/[0.05]'
                  : 'border-transparent hover:border-[var(--op-border)] hover:bg-white/[0.02]'
              }`}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--op-dim)]">{WEEKDAYS[i]}</span>
              <span className={`font-mono text-[15px] tabular-nums ${isToday ? 'text-[var(--op-accent)]' : isSelected ? 'text-[var(--op-text)]' : 'text-[var(--op-sub)]'}`}>
                {String(d.getDate()).padStart(2, '0')}
              </span>
              <span className={`h-1 w-1 rounded-full ${count > 0 ? (isToday ? 'bg-[var(--op-accent)]' : 'bg-[var(--op-dim)]') : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>

      {/* Day agenda */}
      <div className="mt-3 border-t border-[var(--op-border)] pt-3">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">
          {isSelectedToday ? 'Today' : selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>

        {agenda.length === 0 ? (
          <p className="py-3 text-[12px] text-[var(--op-dim)]">Nothing scheduled for this day.</p>
        ) : (
          <div className="space-y-0.5">
            {agenda.map((ev, idx) => (
              <React.Fragment key={ev.key}>
                {idx === nowIndex && (
                  <div className="flex items-center gap-2 py-1">
                    <span className="w-12 flex-shrink-0 text-right font-mono text-[9px] uppercase tracking-wider text-[var(--op-accent)]">now</span>
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--op-accent)]" />
                    <span className="h-px flex-1 bg-[var(--op-accent)]/30" />
                    <span className="font-mono text-[9px] tabular-nums text-[var(--op-accent)]">{nowLabel}</span>
                  </div>
                )}
                <button
                  onClick={() => { if (ev.taskId && ev.parentId) { navigateTo(ev.parentId); selectTask(ev.taskId); } }}
                  className={`group flex w-full items-center gap-3 rounded-md px-1.5 py-2 text-left ${ev.taskId ? 'hover:bg-white/[0.03]' : 'cursor-default'}`}
                >
                  <span className="w-12 flex-shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--op-muted)]">{ev.time || '—'}</span>
                  <span className={`h-7 w-0.5 flex-shrink-0 rounded-full ${ACCENT[ev.kind]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[var(--op-text)]">{ev.title}</span>
                    {ev.area && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--op-dim)]">{ev.area}</span>}
                  </span>
                  {ev.kind === 'due' && (
                    <span className="flex-shrink-0 rounded bg-orange-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-orange-300">Due</span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
}
