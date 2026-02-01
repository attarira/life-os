'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const calendarOnlyDateRef = useRef<HTMLInputElement>(null);
  const existingDateRef = useRef<HTMLInputElement>(null);
  const [calendarView, setCalendarView] = useState('dayGridMonth');

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!calendarOnlyDate) {
      setCalendarOnlyDate(todayKey);
    }
  }, [calendarOnlyDate, todayKey]);

  const calendarEvents: EventInput[] = useMemo(() => {
    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const normalizeDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

    const baseEvents: Array<{
      id: string;
      title: string;
      date: Date;
      dateKey: string;
      classNames: string[];
      extendedProps: Record<string, unknown>;
    }> = [];

    tasks
      .filter(task => task.status !== 'COMPLETED')
      .forEach(task => {
        const scheduled = task.scheduledDate ? new Date(task.scheduledDate) : null;
        const due = task.dueDate ? new Date(task.dueDate) : null;
        if (!scheduled && !due) return;

        if (scheduled && due && toDateKey(scheduled) === toDateKey(due)) {
          const date = normalizeDate(scheduled);
          baseEvents.push({
            id: `${task.id}-both-${toDateKey(date)}`,
            title: task.title,
            date,
            dateKey: toDateKey(date),
            classNames: ['fc-task-event', 'fc-task-event--both'],
            extendedProps: { taskId: task.id, scheduled: true, due: true },
          });
          return;
        }

        if (scheduled) {
          const date = normalizeDate(scheduled);
          baseEvents.push({
            id: `${task.id}-scheduled-${toDateKey(date)}`,
            title: task.title,
            date,
            dateKey: toDateKey(date),
            classNames: ['fc-task-event', 'fc-task-event--scheduled'],
            extendedProps: { taskId: task.id, scheduled: true },
          });
        }

        if (due) {
          const date = normalizeDate(due);
          baseEvents.push({
            id: `${task.id}-due-${toDateKey(date)}`,
            title: task.title,
            date,
            dateKey: toDateKey(date),
            classNames: ['fc-task-event', 'fc-task-event--due'],
            extendedProps: { taskId: task.id, due: true },
          });
        }
      });

    const grouped = new Map<string, typeof baseEvents>();
    baseEvents.forEach((event) => {
      const list = grouped.get(event.dateKey) || [];
      list.push(event);
      grouped.set(event.dateKey, list);
    });

    const results: EventInput[] = [];
    grouped.forEach((eventsForDay) => {
      const total = eventsForDay.length;
      const startHour = 8;
      const endHour = 18;
      const totalMinutes = (endHour - startHour) * 60;
      const step = totalMinutes / (total + 1);

      eventsForDay.forEach((event, index) => {
        const start = new Date(event.date);
        start.setHours(startHour, 0, 0, 0);
        start.setMinutes(Math.round(step * (index + 1)));
        const end = new Date(start);
        end.setMinutes(start.getMinutes() + 45);
        results.push({
          id: event.id,
          title: event.title,
          start,
          end,
          allDay: false,
          classNames: event.classNames,
          extendedProps: event.extendedProps,
        });
      });
    });

    return results;
  }, [tasks]);

  const scheduledCountByDate = useMemo(() => {
    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const counts = new Map<string, number>();
    tasks
      .filter(task => task.status !== 'COMPLETED' && task.scheduledDate)
      .forEach(task => {
        const date = new Date(task.scheduledDate as Date);
        const key = toDateKey(date);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    return counts;
  }, [tasks]);

  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo;
    return (
      <div className="fc-event-min">
        <span className="fc-event-title">{event.title}</span>
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

  const formatDateLabel = (value: string, fallback: string) => {
    if (!value) return fallback;
    if (value === todayKey) return 'Today';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" replace className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            ← Back to dashboard
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Calendar</h1>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="calendar-shell calendar-shell--minimal">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev',
                center: 'title',
                right: 'next',
              }}
              footerToolbar={{
                left: '',
                center: '',
                right: 'dayGridMonth,timeGridDay',
              }}
              buttonIcons={{
                prev: 'chevron-left',
                next: 'chevron-right',
              }}
              buttonText={{
                dayGridMonth: 'Month',
                timeGridDay: 'Day',
              }}
              views={{
                dayGridMonth: { eventDisplay: 'none' },
                timeGridDay: { titleFormat: { year: 'numeric', month: 'long', day: 'numeric' } },
              }}
              editable
              eventStartEditable
              eventDurationEditable={false}
              height="auto"
              expandRows
              dayMaxEvents={7}
              datesSet={(info) => setCalendarView(info.view.type)}
              events={calendarView === 'dayGridMonth' ? [] : calendarEvents}
              eventContent={renderEventContent}
              dayCellContent={(arg) => {
                if (arg.view.type !== 'dayGridMonth') return arg.dayNumberText;
                const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
                const count = scheduledCountByDate.get(key) || 0;
                return (
                  <div className="fc-daycell">
                    <span className="fc-daycell-date">{arg.date.getDate()}</span>
                    {count > 0 && <span className="fc-daycell-count">{count}</span>}
                  </div>
                );
              }}
              eventDrop={(info) => {
                const taskId = info.event.extendedProps?.taskId as string | undefined;
                if (!taskId || !info.event.start) return;
                const hasScheduled = Boolean(info.event.extendedProps?.scheduled);
                const hasDue = Boolean(info.event.extendedProps?.due);
                const updates: Record<string, Date> = {};
                if (hasScheduled) updates.scheduledDate = info.event.start;
                if (hasDue && !hasScheduled) updates.dueDate = info.event.start;
                if (Object.keys(updates).length > 0) {
                  updateTask(taskId, updates);
                }
              }}
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

        <section className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
            <div className="h-full rounded-xl border border-white/10 bg-slate-900 p-3 flex flex-col">
              <form onSubmit={handleAddCalendarOnly} className="flex items-center gap-2">
                <input
                  value={calendarOnlyTitle}
                  onChange={(e) => setCalendarOnlyTitle(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  placeholder="Add new event..."
                  aria-label="Add new event"
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      calendarOnlyDateRef.current?.showPicker?.();
                      calendarOnlyDateRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-full border border-white/10 text-xs text-slate-300 hover:text-slate-100 font-mono"
                  >
                    {formatDateLabel(calendarOnlyDate, 'Today')}
                  </button>
                  <input
                    ref={calendarOnlyDateRef}
                    type="date"
                    value={calendarOnlyDate}
                    onChange={(e) => setCalendarOnlyDate(e.target.value)}
                    className="sr-only"
                    aria-hidden="true"
                  />
                </div>
                <button
                  type="submit"
                  className="p-2 rounded-full border border-white/10 text-slate-300 hover:text-slate-100 hover:border-white/20"
                  disabled={!calendarOnlyTitle.trim() || !calendarOnlyDate}
                  aria-label="Add to calendar"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                  </svg>
                </button>
              </form>
            </div>

            <div className="h-full rounded-xl border border-white/10 bg-slate-900 p-3 flex flex-col">
              <form onSubmit={handleScheduleExisting} className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectionPath([])}
                      className="hover:text-slate-200"
                    >
                      Life Areas
                    </button>
                    {pathTasks.map((task, index) => (
                      <React.Fragment key={task.id}>
                        <span className="text-slate-600">/</span>
                        <button
                          type="button"
                          onClick={() => setSelectionPath(selectionPath.slice(0, index + 1))}
                          className="hover:text-slate-200"
                        >
                          {task.title}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          existingDateRef.current?.showPicker?.();
                          existingDateRef.current?.focus();
                        }}
                        className="px-2.5 py-1 rounded-full border border-white/10 text-xs text-slate-300 hover:text-slate-100 font-mono"
                      >
                        {formatDateLabel(existingScheduledDate, 'Pick date')}
                      </button>
                      <input
                        ref={existingDateRef}
                        type="date"
                        value={existingScheduledDate}
                        onChange={(e) => setExistingScheduledDate(e.target.value)}
                        className="sr-only"
                        aria-hidden="true"
                      />
                    </div>
                    <button
                      type="submit"
                      className="p-2 rounded-full border border-white/10 text-slate-300 hover:text-slate-100 hover:border-white/20 disabled:opacity-40"
                      disabled={!existingTaskId || !existingScheduledDate}
                      aria-label="Schedule task"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto space-y-1 pr-1">
                  {currentChildren.length === 0 ? (
                    <p className="text-xs text-slate-500">No tasks here.</p>
                  ) : (
                    currentChildren.map(child => {
                      const hasChildren = tasks.some(t => t.parentId === child.id);
                      const isSelected = child.id === existingTaskId;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => {
                            if (hasChildren) {
                              setSelectionPath([...selectionPath, child.id]);
                            } else {
                              setExistingTaskId(child.id);
                            }
                          }}
                          className={`group w-full flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-white/10 text-slate-100'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate">{child.title}</span>
                          {!hasChildren && (
                            <span className="opacity-0 group-hover:opacity-100 text-slate-500">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </form>
            </div>
          </div>
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
