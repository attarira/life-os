'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { TaskProvider, useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID } from '@/lib/types';

function CalendarContent() {
  const { tasks, createTask, updateTask, navigateTo, selectTask } = useTaskContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>(ROOT_TASK_ID);
  const [dueDate, setDueDate] = useState<string>('');
  const [existingTaskId, setExistingTaskId] = useState<string>('');
  const [existingDueDate, setExistingDueDate] = useState<string>('');

  const lifeAreas = useMemo(
    () => tasks.filter(t => t.parentId === ROOT_TASK_ID).sort((a, b) => a.order - b.order),
    [tasks]
  );

  const todayTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(t => t.dueDate && t.status !== 'COMPLETED')
      .filter(t => {
        const d = new Date(t.dueDate!);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      })
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
  }, [tasks]);

  const parseDateInput = (value: string) => {
    const parts = value.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d, 12, 0, 0, 0); // local noon
    }
    return new Date(value);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !parentId || !dueDate) return;
    await createTask({
      parentId,
      title: title.trim(),
      description: description.trim() || undefined,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      dueDate: parseDateInput(dueDate),
    });
    setTitle('');
    setDescription('');
    setDueDate('');
  };

  const handleScheduleExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingTaskId || !existingDueDate) return;
    await updateTask(existingTaskId, { dueDate: parseDateInput(existingDueDate) });
    setExistingTaskId('');
    setExistingDueDate('');
  };

  const nonRootTasks = useMemo(() => tasks.filter(t => t.id !== ROOT_TASK_ID), [tasks]);

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
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Add a task to the calendar</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                placeholder="What needs to be done?"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Life area</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              >
                <option value={ROOT_TASK_ID} disabled>
                  Select area
                </option>
                {lifeAreas.map(area => (
                  <option key={area.id} value={area.id}>
                    {area.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                placeholder="Optional notes"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold hover:-translate-y-[1px] transition-transform disabled:opacity-50"
                disabled={!title.trim() || !dueDate || parentId === ROOT_TASK_ID}
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
              <select
                value={existingTaskId}
                onChange={(e) => setExistingTaskId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              >
                <option value="">Select task</option>
                {nonRootTasks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Due date</label>
              <input
                type="date"
                value={existingDueDate}
                onChange={(e) => setExistingDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold hover:-translate-y-[1px] transition-transform disabled:opacity-50"
                disabled={!existingTaskId || !existingDueDate}
              >
                Save to calendar
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Due today</h3>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No tasks scheduled for today.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {todayTasks.map(task => {
                const area = lifeAreas.find(a => a.id === task.parentId);
                return (
                  <button
                    key={task.id}
                    onClick={() => {
                      navigateTo(task.parentId);
                      selectTask(task.id);
                    }}
                    className="w-full text-left py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{task.title}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{area ? area.title : 'Task'}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Due today</span>
                  </button>
                );
              })}
            </div>
          )}
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
