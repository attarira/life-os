'use client';

import React, { useMemo, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { useTravelMode } from '@/lib/travel-mode-context';
import { COLUMNS, Task, TaskStatus } from '@/lib/types';
import { Breadcrumb } from './Breadcrumb';
import { GlobalTray } from './GlobalTray';

function formatDue(task: Task) {
  if (!task.dueDate) return 'No due date';

  const due = new Date(task.dueDate);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const diffDays = Math.round((startOfDue - startOfToday) / msPerDay);

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

function nextOrderForStatus(tasks: Task[], status: TaskStatus) {
  const inStatus = tasks.filter(task => task.status === status);
  return inStatus.length > 0 ? Math.max(...inStatus.map(task => task.order)) + 1 : 0;
}

function TravelBoardTaskRow({
  task,
  onOpen,
  onMove,
}: {
  task: Task;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const dueLabel = formatDue(task);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{task.title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dueLabel}</p>
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          Open
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {COLUMNS.map(column => {
          const active = task.status === column.status;
          return (
            <button
              key={column.status}
              type="button"
              onClick={() => onMove(column.status)}
              disabled={active}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {column.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TravelModeBoard() {
  const {
    tasks,
    currentParentId,
    getVisibleChildren,
    createTask,
    moveTask,
    navigateTo,
    selectTask,
  } = useTaskContext();
  const { setEnabled } = useTravelMode();
  const [draftTitle, setDraftTitle] = useState('');

  const visibleChildren = getVisibleChildren();

  const groupedTasks = useMemo(() => {
    const grouped = new Map<TaskStatus, Task[]>();
    COLUMNS.forEach(column => grouped.set(column.status, []));
    visibleChildren.forEach(task => {
      grouped.get(task.status)?.push(task);
    });
    return grouped;
  }, [visibleChildren]);

  const handleQuickAdd = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) return;

    await createTask({
      parentId: currentParentId,
      title: trimmed,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
    });

    setDraftTitle('');
  };

  const handleOpen = (task: Task) => {
    const hasChildren = tasks.some(candidate => candidate.parentId === task.id);
    if (hasChildren) {
      navigateTo(task.id);
      return;
    }
    selectTask(task.id);
  };

  const handleMove = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    await moveTask(task.id, status, nextOrderForStatus(visibleChildren, status));
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">
              Travel Mode
            </span>
            <GlobalTray />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <section className="rounded-3xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.96))] p-5 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.96))]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Reduced Board</p>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Lightweight task maintenance only. Use search to jump faster, or turn travel mode off for the full board.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
              >
                Turn Off Travel Mode
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex flex-col gap-3 md:flex-row">
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
                placeholder="Quick add a task..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => void handleQuickAdd()}
                disabled={!draftTitle.trim()}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                Add Task
              </button>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {COLUMNS.map(column => {
              const columnTasks = groupedTasks.get(column.status) || [];
              return (
                <div
                  key={column.status}
                  className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{column.label}</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {columnTasks.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-500">
                        No tasks here.
                      </p>
                    ) : (
                      columnTasks.map(task => (
                        <TravelBoardTaskRow
                          key={task.id}
                          task={task}
                          onOpen={() => handleOpen(task)}
                          onMove={(status) => { void handleMove(task, status); }}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
