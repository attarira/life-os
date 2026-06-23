'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { useTravelMode } from '@/lib/travel-mode-context';
import { ROOT_TASK_ID, Task } from '@/lib/types';
import { getOperatorProfile } from '@/lib/repos/operator';

import { TravelModeHomeDashboard } from './TravelModeHomeDashboard';
import { TopNav } from './dashboard/TopNav';
import { OperatorCard, operatorInitials, OPERATOR_UPDATED_EVENT } from './dashboard/OperatorCard';
import { SessionCard } from './dashboard/SessionCard';
import { HabitsCard } from './dashboard/HabitsCard';
import { FinancePulseCard } from './dashboard/FinancePulseCard';
import { NutritionCard } from './dashboard/NutritionCard';
import { GoalsCard } from './dashboard/GoalsCard';
import { TodayKeyCard } from './dashboard/TodayKeyCard';
import { CalendarCard } from './dashboard/CalendarCard';
import { CardShell } from './dashboard/CardShell';

export function HomeDashboard() {
  const { enabled } = useTravelMode();

  if (enabled) {
    return <TravelModeHomeDashboard />;
  }

  return <StandardHomeDashboard />;
}

function UpcomingCard() {
  const { tasks, navigateTo, selectTask } = useTaskContext();

  const parentIds = useMemo(() => new Set(tasks.map((t) => t.parentId)), [tasks]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
    return tasks
      .filter((t) => !parentIds.has(t.id))
      .filter((t) => t.dueDate && t.status !== 'COMPLETED' && !t.calendarOnly)
      .filter((t) => {
        const due = new Date(t.dueDate!);
        return due >= tomorrow && due < windowEnd;
      })
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))
      .slice(0, 6);
  }, [tasks, parentIds]);

  const areaTitle = (task: Task): string | null => {
    let cursor: Task | undefined = task;
    while (cursor && cursor.parentId !== ROOT_TASK_ID) cursor = taskMap.get(cursor.parentId);
    return cursor && cursor.parentId === ROOT_TASK_ID ? cursor.title : null;
  };

  return (
    <CardShell index="05" title="Upcoming">
      {upcoming.length === 0 ? (
        <p className="py-2 text-[12px] text-[var(--op-dim)]">Nothing due in the next week.</p>
      ) : (
        <div className="space-y-0.5">
          {upcoming.map((task) => {
            const due = task.dueDate ? new Date(task.dueDate) : null;
            const dueLabel = due ? due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
            const now = new Date();
            const diffDays = due ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            const rel = diffDays <= 1 ? '1d' : `${diffDays}d`;
            const area = areaTitle(task);
            return (
              <button
                key={task.id}
                onClick={() => { navigateTo(task.parentId); selectTask(task.id); }}
                className="group flex w-full items-start gap-2.5 rounded-md px-1 py-2 text-left hover:bg-white/[0.03]"
              >
                <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-[5px] border-[1.5px] border-[var(--op-dim)] transition-colors group-hover:border-[var(--op-sub)]" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[var(--op-text)]">{task.title}</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    {area && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--op-dim)]">{area}</span>}
                    <span className="font-mono text-[10px] text-[var(--op-muted)]">Due {dueLabel}</span>
                  </div>
                </div>
                <span className="mt-0.5 flex-shrink-0 font-mono text-[10px] tabular-nums text-[var(--op-dim)]">{rel}</span>
              </button>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}

function StandardHomeDashboard() {
  const { navigateTo, tasks, createTask, updateTask, deleteTask } = useTaskContext();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Task | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');

  const lifeAreas = useMemo(
    () => tasks.filter((t) => t.parentId === ROOT_TASK_ID && !t.calendarOnly).sort((a, b) => a.order - b.order),
    [tasks]
  );

  const [operatorName, setOperatorName] = useState('Rayaan');
  useEffect(() => {
    const load = () => getOperatorProfile({ name: 'Rayaan', role: '', location: '', focus: '' })
      .then((p) => setOperatorName(p.name?.trim() || 'Rayaan'))
      .catch(() => {});
    load();
    window.addEventListener(OPERATOR_UPDATED_EVENT, load);
    return () => window.removeEventListener(OPERATOR_UPDATED_EVENT, load);
  }, []);

  const handleExport = () => {
    const payload = JSON.stringify(
      tasks.map((t) => ({ ...t })),
      (_k, v) => (v instanceof Date ? v.toISOString() : v),
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCreateArea = () => {
    setEditingArea(null);
    setEditorTitle('');
    setEditorDescription('');
    setEditorOpen(true);
  };

  const closeEditor = () => setEditorOpen(false);

  const handleEditorSave = async () => {
    const trimmedTitle = editorTitle.trim();
    const trimmedDescription = editorDescription.trim();
    if (!trimmedTitle) return;

    if (editingArea) {
      await updateTask(editingArea.id, {
        title: trimmedTitle,
        description: trimmedDescription || undefined,
      });
    } else {
      await createTask({
        parentId: ROOT_TASK_ID,
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
      });
    }
    closeEditor();
  };

  const handleEditorDelete = async () => {
    if (!editingArea) { closeEditor(); return; }
    const confirmed = confirm(`Delete "${editingArea.title}" and its tasks?`);
    if (!confirmed) return;
    await deleteTask(editingArea.id);
    closeEditor();
  };

  return (
    <div className="op flex h-full flex-col text-[var(--op-text)]">
      <TopNav
        lifeAreas={lifeAreas}
        onNavigate={navigateTo}
        onAddArea={openCreateArea}
        onExport={handleExport}
        initials={operatorInitials(operatorName)}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left column */}
            <div className="space-y-4 lg:col-span-3">
              <OperatorCard />
              <FinancePulseCard />
              <TodayKeyCard />
            </div>

            {/* Center column */}
            <div className="space-y-4 lg:col-span-6">
              <SessionCard name={operatorName} />
              <HabitsCard />
              <CalendarCard />
            </div>

            {/* Right column */}
            <div className="space-y-4 lg:col-span-3">
              <GoalsCard />
              <NutritionCard />
              <UpcomingCard />
            </div>
          </div>
        </div>
      </main>

      {editorOpen && (
        <div className="op fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-[var(--op-border-strong)] bg-[var(--op-panel-solid)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="op-serif text-lg text-[var(--op-text)]">{editingArea ? 'Edit area' : 'New life area'}</h3>
              <button onClick={closeEditor} className="rounded-md p-2 text-[var(--op-muted)] hover:bg-white/[0.04] hover:text-[var(--op-text)]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Title</label>
                <input
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditorSave(); }}
                  className="w-full rounded-md border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-sm text-[var(--op-text)] focus:border-[var(--op-border-strong)] focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-dim)]">Description</label>
                <textarea
                  value={editorDescription}
                  onChange={(e) => setEditorDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-sm text-[var(--op-text)] focus:border-[var(--op-border-strong)] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {editingArea ? (
                <button onClick={handleEditorDelete} className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300">
                  Delete area
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button onClick={closeEditor} className="rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--op-muted)] hover:text-[var(--op-text)]">Cancel</button>
                <button onClick={handleEditorSave} className="rounded-md bg-[var(--op-accent)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#05221a] hover:opacity-90">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
