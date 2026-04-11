'use client';

import React, { useMemo, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { useTravelMode } from '@/lib/travel-mode-context';
import { ROOT_TASK_ID, Task } from '@/lib/types';
import { getTaskPath } from '@/lib/tasks';
import { GlobalTray } from './GlobalTray';

const UPCOMING_WINDOW_DAYS = 14;
const LIST_LIMIT = 8;

function sortByDueThenUpdated(a: Task, b: Task) {
  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function formatDueLabel(task: Task) {
  if (!task.dueDate) return 'No due date';

  const now = new Date();
  const dueDate = new Date(task.dueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const diffDays = Math.round((startOfDue - startOfToday) / msPerDay);
  const absolute = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return `Due today · ${absolute}`;
  if (diffDays === 1) return `Due tomorrow · ${absolute}`;
  return `Due in ${diffDays}d · ${absolute}`;
}

function TravelTaskRow({
  task,
  areaTitle,
  onOpen,
}: {
  task: Task;
  areaTitle: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left transition-colors hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{task.title}</p>
          <p className="mt-1 text-xs text-slate-400">{areaTitle}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
          task.status === 'IN_PROGRESS'
            ? 'bg-blue-500/15 text-blue-300'
            : task.status === 'ON_HOLD'
              ? 'bg-amber-500/15 text-amber-300'
              : 'bg-slate-800 text-slate-400'
        }`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{formatDueLabel(task)}</p>
    </button>
  );
}

export function TravelModeHomeDashboard() {
  const { tasks, navigateTo, selectTask, createTask } = useTaskContext();
  const { setEnabled } = useTravelMode();
  const [draftTitle, setDraftTitle] = useState('');
  const [targetAreaId, setTargetAreaId] = useState('');

  const lifeAreas = useMemo(
    () => tasks
      .filter(task => task.parentId === ROOT_TASK_ID && !task.calendarOnly)
      .sort((a, b) => a.order - b.order),
    [tasks]
  );

  const selectedAreaId = lifeAreas.some(area => area.id === targetAreaId)
    ? targetAreaId
    : (lifeAreas[0]?.id || '');

  const taskMeta = useMemo(() => {
    const openTasks = tasks.filter(task => task.parentId !== ROOT_TASK_ID && !task.calendarOnly && task.status !== 'COMPLETED');
    const now = new Date();
    const upcomingCutoff = new Date(now);
    upcomingCutoff.setDate(upcomingCutoff.getDate() + UPCOMING_WINDOW_DAYS);

    const areaTitleByTaskId = new Map<string, string>();
    openTasks.forEach(task => {
      const area = getTaskPath(tasks, task.id)[0];
      if (area) {
        areaTitleByTaskId.set(task.id, area.title);
      }
    });

    const inProgress = openTasks
      .filter(task => task.status === 'IN_PROGRESS')
      .sort(sortByDueThenUpdated)
      .slice(0, LIST_LIMIT);

    const upcoming = openTasks
      .filter(task => task.dueDate)
      .filter(task => {
        const due = new Date(task.dueDate as Date);
        return due.getTime() <= upcomingCutoff.getTime();
      })
      .sort(sortByDueThenUpdated)
      .slice(0, LIST_LIMIT);

    const openCountByAreaId = new Map<string, number>();
    openTasks.forEach(task => {
      const path = getTaskPath(tasks, task.id);
      const area = path[0];
      if (!area) return;
      openCountByAreaId.set(area.id, (openCountByAreaId.get(area.id) || 0) + 1);
    });

    return {
      areaTitleByTaskId,
      inProgress,
      upcoming,
      openCountByAreaId,
    };
  }, [tasks]);

  const handleQuickAdd = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed || !selectedAreaId) return;

    await createTask({
      parentId: selectedAreaId,
      title: trimmed,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
    });

    setDraftTitle('');
  };

  const openTask = (task: Task) => {
    const area = getTaskPath(tasks, task.id)[0];
    if (!area) return;
    navigateTo(area.id);
    selectTask(task.id);
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="font-semibold text-white">LifeOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Home</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            Travel Mode
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-1">
            <GlobalTray />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[1200px] space-y-6">
          <section className="rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.82))] px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Travel Mode</p>
                <h1 className="mt-2 text-2xl font-semibold text-white">LifeOS is in low-maintenance mode.</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Quick check-ins only: capture something new, review what is active, and use search to jump where you need.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(false)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
              >
                Turn Off Travel Mode
              </button>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Quick Add</p>
                  <p className="mt-1 text-sm text-slate-300">Capture a task without opening the full board.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <input
                  data-quick-add
                  type="text"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleQuickAdd();
                    }
                  }}
                  placeholder="Add a task..."
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
                />
                <select
                  value={selectedAreaId}
                  onChange={(event) => setTargetAreaId(event.target.value)}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition-colors focus:border-slate-500"
                >
                  {lifeAreas.map(area => (
                    <option key={area.id} value={area.id}>{area.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleQuickAdd()}
                  disabled={!draftTitle.trim() || !selectedAreaId}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Life Areas</p>
              <div className="mt-4 space-y-2">
                {lifeAreas.map(area => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => navigateTo(area.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left transition-colors hover:bg-slate-950"
                  >
                    <span className="text-sm font-medium text-slate-100">{area.title}</span>
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                      {taskMeta.openCountByAreaId.get(area.id) || 0} open
                    </span>
                  </button>
                ))}
                {lifeAreas.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                    No life areas available yet.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Now</p>
                  <p className="mt-1 text-sm text-slate-300">The tasks already in motion.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {taskMeta.inProgress.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                    Nothing is currently in progress.
                  </p>
                ) : (
                  taskMeta.inProgress.map(task => (
                    <TravelTaskRow
                      key={task.id}
                      task={task}
                      areaTitle={taskMeta.areaTitleByTaskId.get(task.id) || 'LifeOS'}
                      onOpen={() => openTask(task)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Soon</p>
                  <p className="mt-1 text-sm text-slate-300">Tasks due in the next two weeks.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {taskMeta.upcoming.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                    Nothing urgent is coming up.
                  </p>
                ) : (
                  taskMeta.upcoming.map(task => (
                    <TravelTaskRow
                      key={task.id}
                      task={task}
                      areaTitle={taskMeta.areaTitleByTaskId.get(task.id) || 'LifeOS'}
                      onOpen={() => openTask(task)}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
