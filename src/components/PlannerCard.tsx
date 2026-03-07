'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, ROOT_TASK_ID, TaskRecurrence } from '@/lib/types';
import { PLANNER_ITEMS_STORAGE_KEY, PLANNER_DATE_STORAGE_KEY } from '@/lib/storage-keys';
import { getTaskPath } from '@/lib/tasks';

// ─── Types ───────────────────────────────────────────────────────────────────

type PlannerEntry = {
  id: string; // unique planner-entry ID
  taskId: string | null; // linked task ID, or null for quick-created items
  label: string; // display label
  completed: boolean;
};

type PlannerCardProps = {
  tasks: Task[];
  navigateTo: (id: string) => void;
  selectTask: (id: string | null) => void;
  createTask: (input: any) => Promise<Task>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadPlannerEntries(): PlannerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PLANNER_ITEMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePlannerEntries(entries: PlannerEntry[]) {
  try {
    localStorage.setItem(PLANNER_ITEMS_STORAGE_KEY, JSON.stringify(entries));
  } catch { }
}

function matchesToday(recurrence: TaskRecurrence): boolean {
  const day = new Date().getDay();
  switch (recurrence.rule) {
    case 'daily': return true;
    case 'weekdays': return day >= 1 && day <= 5;
    case 'weekends': return day === 0 || day === 6;
    case 'mwf': return day === 1 || day === 3 || day === 5;
    case 'tth': return day === 2 || day === 4;
    case 'custom': return recurrence.daysOfWeek?.includes(day) ?? false;
  }
  return false;
}

// ─── Area Badge Styling ──────────────────────────────────────────────────────

const AREA_BADGES: Record<string, string> = {
  career: 'bg-blue-500/15 text-blue-300',
  health: 'bg-emerald-500/15 text-emerald-300',
  finances: 'bg-cyan-500/15 text-cyan-300',
  relationships: 'bg-rose-500/15 text-rose-300',
  growth: 'bg-indigo-500/15 text-indigo-300',
  recreation: 'bg-amber-500/15 text-amber-300',
  default: 'bg-slate-500/15 text-slate-400',
};

function resolveAreaKey(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes('career') || lower.includes('job') || lower.includes('work')) return 'career';
  if (lower.includes('health') || lower.includes('fitness') || lower.includes('wellness')) return 'health';
  if (lower.includes('financ') || lower.includes('money') || lower.includes('budget')) return 'finances';
  if (lower.includes('relat') || lower.includes('family') || lower.includes('social')) return 'relationships';
  if (lower.includes('learn') || lower.includes('growth') || lower.includes('develop')) return 'growth';
  if (lower.includes('fun') || lower.includes('hobby') || lower.includes('recreation')) return 'recreation';
  return 'default';
}

// ─── Sortable Row ────────────────────────────────────────────────────────────

function SortablePlannerRow({
  entry,
  linkedTask,
  areaLabel,
  areaBadge,
  onToggle,
  onRemove,
  onNavigate,
}: {
  entry: PlannerEntry;
  linkedTask: Task | null;
  areaLabel: string;
  areaBadge: string;
  onToggle: () => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/40 last:border-b-0 transition-all ${isDragging
        ? 'opacity-50 bg-slate-800/40 z-10 shadow-lg rounded-lg'
        : 'hover:bg-slate-800/30'
        }`}
    >
      {/* Drag handle area — invisible, whole row drags on hover via the grip zone */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-40 transition-opacity"
        aria-label="Drag to reorder"
      >
        <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`flex-shrink-0 w-4 h-4 rounded-[5px] border-[1.5px] transition-all flex items-center justify-center ${entry.completed
          ? 'bg-emerald-500/80 border-emerald-500/80 text-white'
          : 'border-slate-600 hover:border-slate-400'
          }`}
      >
        {entry.completed && (
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Label + area badge */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onNavigate}
      >
        <span
          className={`text-[13px] leading-snug block truncate transition-all ${entry.completed
            ? 'text-slate-500 line-through'
            : 'text-slate-100'
            }`}
        >
          {entry.label}
        </span>
      </div>

      {/* Area badge */}
      {areaLabel && areaLabel !== 'Task' && (
        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-md ${areaBadge}`}>
          {areaLabel}
        </span>
      )}

      {/* Remove icon */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
        aria-label="Remove from planner"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Drag Overlay Preview ────────────────────────────────────────────────────

function PlannerRowPreview({ entry }: { entry: PlannerEntry }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-lg shadow-2xl backdrop-blur-sm">
      <div className={`w-4 h-4 rounded-[5px] border-[1.5px] ${entry.completed
        ? 'bg-emerald-500/80 border-emerald-500/80'
        : 'border-slate-500'
        }`} />
      <span className="text-[13px] text-slate-200">{entry.label}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PlannerCard({ tasks, navigateTo, selectTask, createTask }: PlannerCardProps) {
  const [entries, setEntries] = useState<PlannerEntry[]>(() => loadPlannerEntries());
  const [draft, setDraft] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Auto-populate recurring tasks & handle daily rollover
  useEffect(() => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const storedDate = typeof window !== 'undefined' ? localStorage.getItem(PLANNER_DATE_STORAGE_KEY) : todayStr;

    setEntries(prev => {
      let next = [...prev];
      let changed = false;

      // Handle daily rollover
      if (storedDate !== todayStr && typeof window !== 'undefined') {
        next = next.filter(e => !e.completed);
        localStorage.setItem(PLANNER_DATE_STORAGE_KEY, todayStr);
        changed = true;
      }

      const autoTasks = tasks.filter(t => t.recurrence && matchesToday(t.recurrence));
      autoTasks.forEach(rt => {
        if (!next.some(e => e.taskId === rt.id)) {
          next.push({ id: buildId(), taskId: rt.id, label: rt.title, completed: false });
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tasks]);

  // Persist entries
  useEffect(() => {
    savePlannerEntries(entries);
  }, [entries]);

  // Listen for global planner add events
  useEffect(() => {
    const handlePlannerAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ task: Task }>;
      if (!customEvent.detail?.task) return;
      
      const t = customEvent.detail.task;
      setEntries(prev => {
        if (prev.some(entry => entry.taskId === t.id)) return prev;
        return [...prev, { id: buildId(), taskId: t.id, label: t.title, completed: false }];
      });
    };
    
    window.addEventListener('lifeos:planner-add', handlePlannerAdd);
    return () => window.removeEventListener('lifeos:planner-add', handlePlannerAdd);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Search Results ──────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = draft.toLowerCase().trim();
    if (!q) return [];

    const existingTaskIds = new Set(entries.filter(e => e.taskId).map(e => e.taskId));

    return tasks
      .filter(t => t.parentId !== ROOT_TASK_ID) // exclude area-level items
      .filter(t => !t.calendarOnly)
      .filter(t => t.status !== 'COMPLETED')
      .filter(t => !existingTaskIds.has(t.id))
      .filter(t => t.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [draft, tasks, entries]);

  const hasExactMatch = useMemo(
    () => searchResults.some(r => r.title.toLowerCase() === draft.toLowerCase().trim()),
    [searchResults, draft]
  );

  // ─── Handlers ────────────────────────────────────────────────────────────

  const attachTask = useCallback((task: Task) => {
    const path = getTaskPath(tasks, task.id);
    const areaTask = path[0];
    setEntries(prev => [
      ...prev,
      {
        id: buildId(),
        taskId: task.id,
        label: task.title,
        completed: false,
      },
    ]);
    setDraft('');
    setShowDropdown(false);
    setHighlightIndex(-1);
  }, [tasks]);

  const quickCreate = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    // Create a real task in the system
    const newTask = await createTask({
      parentId: ROOT_TASK_ID,
      title: trimmed,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      calendarOnly: true,
    });

    setEntries(prev => [
      ...prev,
      {
        id: buildId(),
        taskId: newTask.id,
        label: trimmed,
        completed: false,
      },
    ]);
    setDraft('');
    setShowDropdown(false);
    setHighlightIndex(-1);
  }, [createTask]);

  const toggleEntry = useCallback((entryId: string) => {
    setEntries(prev =>
      prev.map(e => (e.id === entryId ? { ...e, completed: !e.completed } : e))
    );
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = searchResults.length + (draft.trim() && !hasExactMatch ? 1 : 0);
      setHighlightIndex(prev => Math.min(prev + 1, max - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < searchResults.length) {
        attachTask(searchResults[highlightIndex]);
      } else {
        quickCreate(draft);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIndex(-1);
    }
  };

  // ─── Drag Handlers ──────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragId(null);
    if (!over || active.id === over.id) return;
    setEntries(prev => {
      const oldIndex = prev.findIndex(e => e.id === active.id);
      const newIndex = prev.findIndex(e => e.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const dragEntry = dragId ? entries.find(e => e.id === dragId) : null;

  // ─── Stats ───────────────────────────────────────────────────────────────

  const completedCount = entries.filter(e => e.completed).length;
  const totalCount = entries.length;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400 font-medium">Planner</p>
            </div>
          </div>
          {totalCount > 0 && (
            <span className="text-[11px] text-slate-500 tabular-nums">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>

        {/* Dual-Action Input */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 pl-3 pr-1.5 py-1.5 focus-within:border-blue-500/40 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setShowDropdown(true);
                setHighlightIndex(-1);
              }}
              onFocus={() => draft.trim() && setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Add task or search..."
              className="flex-1 bg-transparent text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          {/* Dropdown */}
          {showDropdown && draft.trim() && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl overflow-hidden"
            >
              {searchResults.map((task, idx) => {
                const path = getTaskPath(tasks, task.id);
                const areaTask = path[0];
                const areaKey = resolveAreaKey(areaTask?.title || '');
                const areaLabel = areaTask?.title || '';
                const areaBadge = AREA_BADGES[areaKey] || AREA_BADGES.default;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => attachTask(task)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] transition-colors ${highlightIndex === idx
                      ? 'bg-blue-500/10 text-blue-300'
                      : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                  >
                    <svg className="w-3 h-3 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                    </svg>
                    <span className="truncate flex-1">{task.title}</span>
                    {areaLabel && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${areaBadge}`}>
                        {areaLabel}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Quick-create option */}
              {draft.trim() && !hasExactMatch && (
                <button
                  type="button"
                  onClick={() => quickCreate(draft)}
                  onMouseEnter={() => setHighlightIndex(searchResults.length)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] border-t border-slate-800/40 transition-colors ${highlightIndex === searchResults.length
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/50'
                    }`}
                >
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                  <span>Create &ldquo;<strong>{draft.trim()}</strong>&rdquo;</span>
                </button>
              )}

              {searchResults.length === 0 && !draft.trim() && (
                <div className="px-3 py-3 text-xs text-slate-500">Start typing to search tasks...</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      {entries.length === 0 ? (
        <div className="px-5 pb-5 pt-1">
          <p className="text-[13px] text-slate-600">
            Add tasks to start planning your day.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={entries.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="border-t border-slate-800/60">
              {entries.map(entry => {
                const linkedTask = entry.taskId
                  ? tasks.find(t => t.id === entry.taskId) || null
                  : null;
                const path = linkedTask ? getTaskPath(tasks, linkedTask.id) : [];
                const areaTask = path[0];
                const areaKey = resolveAreaKey(areaTask?.title || '');
                const areaLabel = areaTask?.title || 'Task';
                const areaBadge = AREA_BADGES[areaKey] || AREA_BADGES.default;

                return (
                  <SortablePlannerRow
                    key={entry.id}
                    entry={entry}
                    linkedTask={linkedTask}
                    areaLabel={areaLabel}
                    areaBadge={areaBadge}
                    onToggle={() => toggleEntry(entry.id)}
                    onRemove={() => removeEntry(entry.id)}
                    onNavigate={() => {
                      if (linkedTask) {
                        navigateTo(linkedTask.parentId);
                        selectTask(linkedTask.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {dragEntry ? <PlannerRowPreview entry={dragEntry} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Progress bar (only if entries exist) */}
      {totalCount > 0 && (
        <div className="px-5 pb-4 pt-2">
          <div className="h-1 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
