'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
import { TaskProvider, useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID, Task } from '@/lib/types';

function CalendarContent() {
  const { tasks, createTask, updateTask, navigateTo, selectTask } = useTaskContext();
  const [existingTaskId, setExistingTaskId] = useState<string>('');
  const [existingScheduledDate, setExistingScheduledDate] = useState<string>('');
  const [selectionPath, setSelectionPath] = useState<string[]>([]);
  const [calendarOnlyTitle, setCalendarOnlyTitle] = useState('');
  const [calendarOnlyDate, setCalendarOnlyDate] = useState('');

  const lifeAreas = useMemo(
    () => tasks.filter(t => t.parentId === ROOT_TASK_ID).sort((a, b) => a.order - b.order),
    [tasks]
  );

  const calendarEvents: EventInput[] = useMemo(() => {
    const events: EventInput[] = [];
    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const normalizeDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

    tasks
      .filter(task => task.status !== 'COMPLETED')
      .forEach(task => {
        const scheduled = task.scheduledDate ? new Date(task.scheduledDate) : null;
        const due = task.dueDate ? new Date(task.dueDate) : null;
        if (!scheduled && !due) return;

        if (scheduled && due && toDateKey(scheduled) === toDateKey(due)) {
          const start = normalizeDate(scheduled);
          events.push({
            id: `${task.id}-both-${toDateKey(start)}`,
            title: task.title,
            start,
            allDay: true,
            classNames: ['fc-task-event', 'fc-task-event--both'],
            extendedProps: { taskId: task.id, scheduled: true, due: true },
          });
          return;
        }

        if (scheduled) {
          const start = normalizeDate(scheduled);
          events.push({
            id: `${task.id}-scheduled-${toDateKey(start)}`,
            title: task.title,
            start,
            allDay: true,
            classNames: ['fc-task-event', 'fc-task-event--scheduled'],
            extendedProps: { taskId: task.id, scheduled: true },
          });
        }

        if (due) {
          const start = normalizeDate(due);
          events.push({
            id: `${task.id}-due-${toDateKey(start)}`,
            title: task.title,
            start,
            allDay: true,
            classNames: ['fc-task-event', 'fc-task-event--due'],
            extendedProps: { taskId: task.id, due: true },
          });
        }
      });

    return events;
  }, [tasks]);

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo;
    const scheduled = Boolean(event.extendedProps?.scheduled);
    const due = Boolean(event.extendedProps?.due);
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[11px] font-semibold leading-snug">{event.title}</div>
        <div className="flex flex-wrap gap-1">
          {scheduled && (
            <span className="inline-flex items-center rounded-md border border-slate-300/50 bg-slate-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-200">
              Scheduled
            </span>
          )}
          {due && (
            <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">
              Due
            </span>
          )}
        </div>
      </div>
    );
  };

  const parseDateInput = (value: string) => {
    const parts = value.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d, 12, 0, 0, 0); // local noon
    }
    return new Date(value);
  };

  const handleAddCalendarOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarOnlyTitle.trim() || !calendarOnlyDate) return;
    await createTask({
      parentId: ROOT_TASK_ID,
      title: calendarOnlyTitle.trim(),
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      scheduledDate: parseDateInput(calendarOnlyDate),
      calendarOnly: true,
    });
    setCalendarOnlyTitle('');
    setCalendarOnlyDate('');
  };

  const handleScheduleExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingTaskId || !existingScheduledDate) return;
    const targetTask = taskById.get(existingTaskId);
    if (!targetTask || targetTask.status === 'COMPLETED' || targetTask.calendarOnly) return;
    await updateTask(existingTaskId, { scheduledDate: parseDateInput(existingScheduledDate) });
    setExistingTaskId('');
    setExistingScheduledDate('');
  };

  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const pathTasks = useMemo(
    () => selectionPath.map(id => taskById.get(id)).filter(Boolean) as Task[],
    [selectionPath, taskById]
  );
  const currentParentId = selectionPath.length > 0 ? selectionPath[selectionPath.length - 1] : ROOT_TASK_ID;
  const currentChildren = useMemo(
    () =>
      tasks
        .filter(t => t.parentId === currentParentId && t.status !== 'COMPLETED' && !t.calendarOnly)
        .sort((a, b) => a.order - b.order),
    [tasks, currentParentId]
  );
  const selectedTask = existingTaskId ? taskById.get(existingTaskId) ?? null : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            ← Back to dashboard
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Calendar</h1>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Calendar</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Month, week, and day views</span>
          </div>
          <div className="calendar-shell">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              height="auto"
              expandRows
              dayMaxEvents={3}
              events={calendarEvents}
              eventContent={renderEventContent}
              eventClick={(info) => {
                const taskId = info.event.extendedProps?.taskId as string | undefined;
                if (!taskId) return;
                const task = taskById.get(taskId);
                if (!task) return;
                navigateTo(task.parentId);
                selectTask(task.id);
              }}
            />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Add a calendar-only item</h2>
          <form onSubmit={handleAddCalendarOnly} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Title</label>
              <input
                value={calendarOnlyTitle}
                onChange={(e) => setCalendarOnlyTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                placeholder="e.g. Get groceries"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Scheduled date</label>
              <input
                type="date"
                value={calendarOnlyDate}
                onChange={(e) => setCalendarOnlyDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold hover:-translate-y-[1px] transition-transform disabled:opacity-50"
                disabled={!calendarOnlyTitle.trim() || !calendarOnlyDate}
              >
                Add to calendar
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Schedule an existing task</h2>
          <form onSubmit={handleScheduleExisting} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Task</label>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => setSelectionPath([])}
                    className={`px-2 py-1 rounded-md border transition-colors ${
                      selectionPath.length === 0
                        ? 'border-slate-400 text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-700/60'
                        : 'border-transparent hover:border-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    Life areas
                  </button>
                  {pathTasks.map((task, index) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectionPath(selectionPath.slice(0, index + 1))}
                      className="px-2 py-1 rounded-md border border-transparent hover:border-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/40"
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
                <div className="max-h-64 overflow-auto space-y-1">
                  {currentChildren.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 px-2 py-3">No tasks here.</p>
                  ) : (
                    currentChildren.map(child => {
                      const hasChildren = tasks.some(t => t.parentId === child.id);
                      const isSelected = child.id === existingTaskId;
                      return (
                        <div
                          key={child.id}
                          className={`flex items-center justify-between gap-2 px-2 py-2 rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-slate-400 bg-white dark:bg-slate-700/60'
                              : 'border-transparent hover:border-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectionPath([...selectionPath, child.id]);
                              } else {
                                setExistingTaskId(child.id);
                              }
                            }}
                            className="text-left flex-1"
                          >
                            <div className="text-sm text-slate-900 dark:text-white">{child.title}</div>
                            {hasChildren && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Contains subtasks</div>
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={() => setSelectionPath([...selectionPath, child.id])}
                                className="text-[11px] px-2 py-1 rounded-md border border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-300 dark:hover:text-white"
                              >
                                Open →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedTask && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Selected: <span className="text-slate-700 dark:text-slate-200">{selectedTask.title}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Scheduled date</label>
              <input
                type="date"
                value={existingScheduledDate}
                onChange={(e) => setExistingScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold hover:-translate-y-[1px] transition-transform disabled:opacity-50"
                disabled={!existingTaskId || !existingScheduledDate}
              >
                Save to calendar
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <TaskProvider>
      <CalendarContent />
    </TaskProvider>
  );
}
