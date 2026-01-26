'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskContext } from '@/lib/task-context';
import { COLUMNS, ROOT_TASK_ID, Task, TaskStatus } from '@/lib/types';
import { getSubtreeIds } from '@/lib/tasks';

type DragHandleProps = {
  ref: (el: HTMLElement | null) => void;
  listeners?: any;
  attributes?: any;
};

type AreaSnapshot = {
  area: Task;
  statusCounts: Record<TaskStatus, number>;
  total: number;
  dueSoon: boolean;
};

const LIFE_AREA_ICONS: Record<string, React.JSX.Element> = {
  career: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8" width="16" height="10" rx="2" />
      <path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
      <path d="M10 13h4" />
    </svg>
  ),
  health: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v16" />
      <path d="M4 12h16" />
    </svg>
  ),
  finances: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6v12" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  ),
  relationships: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10a4 4 0 110-8 4 4 0 010 8z" />
      <path d="M17 12a3 3 0 110-6 3 3 0 010 6z" />
      <path d="M3 22v-1.5A5.5 5.5 0 018.5 15H10" />
      <path d="M14 22v-1a5 5 0 015-5h1" />
    </svg>
  ),
  growth: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 20c3-6 5-9 7-9s3 2 7 9" />
      <path d="M12 11V4" />
      <path d="M10 6l2-2 2 2" />
    </svg>
  ),
  recreation: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19l7-14 7 14H5z" />
      <path d="M9 15h6" />
    </svg>
  ),
};

const AREA_TONES: Record<string, { bg: string; text: string }> = {
  career: { bg: 'bg-blue-900/40', text: 'text-blue-200' },
  health: { bg: 'bg-emerald-900/40', text: 'text-emerald-200' },
  finances: { bg: 'bg-cyan-900/40', text: 'text-cyan-200' },
  relationships: { bg: 'bg-rose-900/40', text: 'text-rose-200' },
  growth: { bg: 'bg-indigo-900/40', text: 'text-indigo-200' },
  recreation: { bg: 'bg-amber-900/40', text: 'text-amber-200' },
};

function resolveAreaKey(id: string) {
  const key = id.toLowerCase();
  if (key.includes('health') || key.includes('well')) return 'health';
  if (key.includes('finance') || key.includes('budget')) return 'finances';
  if (key.includes('relation') || key.includes('family') || key.includes('social')) return 'relationships';
  if (key.includes('career') || key.includes('work') || key.includes('job')) return 'career';
  if (key.includes('grow') || key.includes('learn') || key.includes('personal')) return 'growth';
  if (key.includes('recre') || key.includes('play') || key.includes('fun')) return 'recreation';
  return id;
}

function isDueWithinThreeDays(task: Task): boolean {
  if (!task.dueDate || task.status === 'COMPLETED') return false;
  const now = new Date().getTime();
  const diffDays = (task.dueDate.getTime() - now) / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}

function LifeAreaCard({
  area,
  statusCounts,
  total,
  dueSoon,
  onOpen,
  onEdit,
  cardRef,
  style,
  dragHandleProps,
  isDragging,
  muted,
  isActive,
}: {
  area: Task;
  statusCounts: Record<TaskStatus, number>;
  total: number;
  dueSoon: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  cardRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
  muted?: boolean;
  isActive?: boolean;
}) {
  const toneKey = resolveAreaKey(area.title || area.id || '');
  const icon = LIFE_AREA_ICONS[toneKey] || (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 9h6V4H4v5zM14 9h6V4h-6v5zM4 20h6v-5H4v5zM14 20h6v-5h-6v5z" />
    </svg>
  );
  const tone = AREA_TONES[toneKey] || { bg: 'bg-slate-800/70', text: 'text-slate-200' };

  return (
    <div
      ref={cardRef}
      onClick={onOpen}
      className={`group relative overflow-hidden flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-left shadow-sm transition-all ${
        isDragging ? 'ring-2 ring-slate-300 dark:ring-slate-700 shadow-lg' : 'hover:shadow-md hover:-translate-y-0.5'
      } ${isActive ? 'border-slate-300 dark:border-slate-600 shadow-md' : ''} ${muted ? 'pointer-events-none' : 'cursor-pointer'}`}
      style={{ ...(style || {}), ['--tile-pad' as string]: '12px' }}
    >
      <div className="flex items-start gap-3 relative" style={{ paddingRight: 'calc(var(--tile-pad) + 32px + 12px)' }}>
        <div className="flex items-start gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone.bg} ${tone.text}`}
          >
            <span className="flex items-center justify-center leading-none">{icon}</span>
          </div>
        <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">{area.title}</h3>
              {dueSoon && (
                <span
                  className="inline-flex items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                >
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a1 1 0 01.894.553l9 18A1 1 0 0121 22H3a1 1 0 01-.894-1.447l9-18A1 1 0 0112 2zm0 6a1 1 0 00-1 1v4a1 1 0 001 1h.01a1 1 0 001-1V9a1 1 0 00-1.01-1zM12 17a1.25 1.25 0 100-2.5A1.25 1.25 0 0012 17z" />
                  </svg>
                  Due soon
                </span>
              )}
            </div>
            {area.description ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{area.description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute flex items-center gap-3" style={{ top: 'var(--tile-pad)', right: 'var(--tile-pad)' }}>
        {dragHandleProps && (
          <button
            ref={dragHandleProps.ref}
            {...dragHandleProps.listeners}
            {...dragHandleProps.attributes}
            onClick={(e) => e.stopPropagation()}
            className="h-8 w-8 rounded-lg text-slate-400 bg-transparent grid place-items-center transition-all duration-150 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-white/30"
            style={{ opacity: 0.55 }}
            aria-label={`Reorder ${area.title}`}
          >
            <div className="h-full w-full rounded-lg hover:bg-white/5 dark:hover:bg-white/10 border border-transparent hover:border-white/10 grid place-items-center transition-colors duration-150">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 11-4 0 2 2 0 014 0zM7 8a2 2 0 11-4 0 2 2 0 014 0zM7 14a2 2 0 11-4 0 2 2 0 014 0zM13 2a2 2 0 11-4 0 2 2 0 014 0zM13 8a2 2 0 11-4 0 2 2 0 014 0zM13 14a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </button>
        )}
        {onEdit && (
          <button
            onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-100 dark:text-slate-400 dark:hover:text-white bg-transparent hover:bg-white/5 dark:hover:bg-white/10 grid place-items-center transition-colors duration-150"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COLUMNS.map(col => (
          <div
            key={col.status}
            className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 px-3 py-2"
          >
            <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{col.label}</span>
            <span className="text-base font-semibold text-slate-900 dark:text-white">{statusCounts[col.status] || 0}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        {total === 0 ? (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">No active work</span>
        ) : (
          <span className="font-medium text-slate-700 dark:text-slate-200">{total} tasks</span>
        )}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pl-3">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function SortableLifeAreaCard({
  snapshot,
  onOpen,
  onEdit,
  isActive,
}: {
  snapshot: AreaSnapshot;
  onOpen: () => void;
  onEdit: () => void;
  isActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: snapshot.area.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <LifeAreaCard
      area={snapshot.area}
      statusCounts={snapshot.statusCounts}
      total={snapshot.total}
      dueSoon={snapshot.dueSoon}
      onOpen={onOpen}
      onEdit={onEdit}
      isActive={isActive}
      cardRef={setNodeRef}
      dragHandleProps={{ ref: setActivatorNodeRef, listeners, attributes }}
      style={style}
      isDragging={isDragging}
    />
  );
}

export function HomeDashboard() {
  const { navigateTo, tasks, setSearchOpen, createTask, reorderTasks, updateTask, deleteTask } = useTaskContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Task | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const lifeAreas = useMemo(
    () => tasks.filter(t => t.parentId === ROOT_TASK_ID).sort((a, b) => a.order - b.order),
    [tasks]
  );

  const areaSnapshots: AreaSnapshot[] = useMemo(() => {
    return lifeAreas.map(area => {
      const immediateTasks = tasks.filter(t => t.parentId === area.id);

      const statusCounts = COLUMNS.reduce((acc, col) => {
        acc[col.status] = immediateTasks.filter(t => t.status === col.status).length;
        return acc;
      }, {} as Record<TaskStatus, number>);

      const dueSoon = immediateTasks.some(isDueWithinThreeDays);

      return {
        area,
        statusCounts,
        total: immediateTasks.length,
        dueSoon,
      };
    });
  }, [lifeAreas, tasks]);

  const primaryAreaId = useMemo(() => {
    if (areaSnapshots.length === 0) return null;
    const scored = areaSnapshots
      .map(s => ({
        id: s.area.id,
        score: (s.statusCounts['IN_PROGRESS'] || 0) + (s.statusCounts['ON_HOLD'] || 0),
      }))
      .sort((a, b) => b.score - a.score || lifeAreas.findIndex(l => l.id === a.id) - lifeAreas.findIndex(l => l.id === b.id));
    return scored[0]?.id || null;
  }, [areaSnapshots, lifeAreas]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = lifeAreas.findIndex(area => area.id === active.id);
    const newIndex = lifeAreas.findIndex(area => area.id === over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(lifeAreas, oldIndex, newIndex).map(area => area.id);
    await reorderTasks(reordered, 'NOT_STARTED');
  };

  const openEditor = (area?: Task) => {
    if (area) {
      setEditingArea(area);
      setEditorTitle(area.title);
      setEditorDescription(area.description || '');
    } else {
      setEditingArea(null);
      setEditorTitle('');
      setEditorDescription('');
    }
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };

  const handleEditorSave = async () => {
    const trimmedTitle = editorTitle.trim();
    const trimmedDescription = editorDescription.trim();
    if (!trimmedTitle) return;

    if (editingArea) {
      await updateTask(editingArea.id, {
        title: trimmedTitle,
        description: trimmedDescription ? trimmedDescription : undefined,
      });
    } else {
      await createTask({
        parentId: ROOT_TASK_ID,
        title: trimmedTitle,
        description: trimmedDescription ? trimmedDescription : undefined,
        status: 'NOT_STARTED',
        priority: 'MEDIUM',
      });
    }

    closeEditor();
  };

  const handleEditorDelete = async () => {
    if (!editingArea) {
      closeEditor();
      return;
    }
    const confirmed = confirm(`Delete "${editingArea.title}" and its tasks?`);
    if (!confirmed) return;
    await deleteTask(editingArea.id);
    closeEditor();
  };

  const activeArea = activeId ? areaSnapshots.find(a => a.area.id === activeId) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">LifeOS</h1>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-slate-400 dark:text-slate-500">
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => openEditor()}
                className="p-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:-translate-y-[1px] transition-transform"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <SortableContext items={lifeAreas.map(area => area.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-6">
                {areaSnapshots.map(snapshot => (
                  <SortableLifeAreaCard
                    key={snapshot.area.id}
                    snapshot={snapshot}
                    onOpen={() => navigateTo(snapshot.area.id)}
                    onEdit={() => openEditor(snapshot.area)}
                    isActive={primaryAreaId === snapshot.area.id}
                  />
                ))}
                {lifeAreas.length === 0 && (
                  <div className="col-span-full flex items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-12 text-slate-500 dark:text-slate-400" />
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeArea ? (
                <LifeAreaCard
                  area={activeArea.area}
                  statusCounts={activeArea.statusCounts}
                  total={activeArea.total}
                  dueSoon={activeArea.dueSoon}
                  onOpen={() => {}}
                  muted
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          {editorOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4 py-8 z-50">
              <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editingArea ? 'Edit area' : 'New area'}</h3>
                  <button
                    onClick={closeEditor}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Title</label>
                    <input
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-[0.12em] text-slate-500">Description</label>
                    <textarea
                      value={editorDescription}
                      onChange={(e) => setEditorDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 resize-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {editingArea ? (
                    <button
                      onClick={handleEditorDelete}
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete area
                    </button>
                  ) : <span />}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={closeEditor}
                      className="px-3 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditorSave}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
