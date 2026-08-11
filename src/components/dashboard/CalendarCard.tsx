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
  kind: 'scheduled' | 'due' | 'both';
  taskId: string;
  parentId: string;
};

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

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
};

export function CalendarCard() {
  const { tasks, selectTask, updateTask, deleteTask, createTask } = useTaskContext();
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

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
  const agenda = eventsByDay.get(selectedKey) || [];

  const monthLabel = weekDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowLabel = fmt(new Date());

  const shiftWeek = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  };

  const handleCreateEvent = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const schedDate = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 12, 0, 0, 0);
    const rootAreas = tasks.filter((t) => t.parentId === ROOT_TASK_ID);
    const parentId = rootAreas.length > 0 ? rootAreas[0].id : ROOT_TASK_ID;

    await createTask({
      parentId,
      title,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      scheduledDate: schedDate,
    });
    setNewTitle('');
    setIsAdding(false);
  };

  const handleStartInlineEdit = (ev: AgendaItem) => {
    setEditingId(ev.taskId);
    setEditingTitle(ev.title);
  };

  const handleSaveInlineEdit = async (taskId: string) => {
    const trimmedTitle = editingTitle.trim();
    if (trimmedTitle && trimmedTitle !== taskMap.get(taskId)?.title) {
      await updateTask(taskId, { title: trimmedTitle });
    }
    setEditingId(null);
  };

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await deleteTask(taskId);
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
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="rounded p-1 text-[var(--op-dim)] hover:bg-white/[0.06] hover:text-[var(--op-text)] transition-colors"
            title="Add Event for selected date"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
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
      {/* Quick Add Form */}
      {isAdding && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--op-accent)]/50 bg-[var(--op-inset)] px-3 py-1.5">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateEvent();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            placeholder={`Schedule for ${selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}…`}
            className="flex-1 bg-transparent text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleCreateEvent}
            disabled={!newTitle.trim()}
            className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--op-accent)] hover:bg-[var(--op-accent)]/10 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const key = dayKey(d);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const count = (eventsByDay.get(key) || []).length;
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
          <div className="py-6 text-center">
            <p className="text-[12px] text-[var(--op-dim)]">Nothing scheduled for this day.</p>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-2 text-[11px] font-mono text-[var(--op-accent)] hover:underline"
            >
              + Schedule an event
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {agenda.map((ev, idx) => {
              const isEditingThis = editingId === ev.taskId;
              return (
                <React.Fragment key={ev.key}>
                  {idx === nowIndex && (
                    <div className="flex items-center gap-2 py-1">
                      <span className="w-12 flex-shrink-0 text-right font-mono text-[9px] uppercase tracking-wider text-[var(--op-accent)]">now</span>
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--op-accent)]" />
                      <span className="h-px flex-1 bg-[var(--op-accent)]/30" />
                      <span className="font-mono text-[9px] tabular-nums text-[var(--op-accent)]">{nowLabel}</span>
                    </div>
                  )}
                  <div
                    className="group flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <button
                      onClick={() => updateTask(ev.taskId, { status: 'COMPLETED' })}
                      className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border border-[var(--op-dim)] transition-colors hover:border-[var(--op-accent)] hover:bg-[var(--op-accent)]/10"
                      title="Mark as completed"
                      aria-label={`Complete ${ev.title}`}
                    />
                    <span className="w-10 flex-shrink-0 text-right font-mono text-[10px] tabular-nums text-[var(--op-muted)]">{ev.time || '—'}</span>
                    <span className={`h-6 w-0.5 flex-shrink-0 rounded-full ${ACCENT[ev.kind]}`} />
                    
                    <div className="min-w-0 flex-1">
                      {isEditingThis ? (
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveInlineEdit(ev.taskId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineEdit(ev.taskId);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full border-b border-[var(--op-accent)] bg-transparent text-[13px] text-[var(--op-text)] focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => selectTask(ev.taskId)}
                          className="cursor-pointer"
                        >
                          <span className="block truncate text-[13px] text-[var(--op-text)] group-hover:text-[var(--op-accent)] transition-colors">{ev.title}</span>
                          {ev.area && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--op-dim)]">{ev.area}</span>}
                        </div>
                      )}
                    </div>

                    {ev.kind === 'due' && (
                      <span className="flex-shrink-0 rounded bg-orange-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-orange-300">Due</span>
                    )}

                    <div className="flex items-center gap-1 text-[var(--op-dim)]">
                      <button
                        onClick={() => handleStartInlineEdit(ev)}
                        className="p-1 rounded hover:bg-white/[0.06] hover:text-[var(--op-text)] transition-colors"
                        title="Rename item inline"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteTask(e, ev.taskId)}
                        className="p-1 rounded hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                        title="Delete item"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </CardShell>
  );
}
