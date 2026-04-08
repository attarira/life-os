'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { CreateTaskInput, Task, TaskRecurrence, ROOT_TASK_ID, UpdateTaskInput } from '@/lib/types';
import { PLANNER_ITEMS_STORAGE_KEY, PLANNER_DATE_STORAGE_KEY, PLANNER_DISMISSED_STORAGE_KEY } from '@/lib/storage-keys';
import { getTaskPath } from '@/lib/tasks';
import { resolveAreaKey } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type PlannerEntry = {
  id: string; // unique planner-entry ID
  taskId: string | null; // linked task ID, or null for quick-created items
  label: string; // display label
  completed: boolean;
  startTime?: string;
  endTime?: string;
};

type PlannerCardProps = {
  tasks: Task[];
  navigateTo: (id: string) => void;
  selectTask: (id: string | null) => void;
  createTask: (input: Omit<CreateTaskInput, 'order'>) => Promise<Task>;
  updateTask: (id: string, updates: UpdateTaskInput) => Promise<Task>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTimeValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

function compareTimeValues(a?: string, b?: string) {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function normalizePlannerEntry(entry: unknown): PlannerEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string' || typeof candidate.completed !== 'boolean') {
    return null;
  }

  const startTime = normalizeTimeValue(candidate.startTime);
  const endTime = normalizeTimeValue(candidate.endTime);

  return {
    id: candidate.id,
    taskId: typeof candidate.taskId === 'string' ? candidate.taskId : null,
    label: candidate.label,
    completed: candidate.completed,
    startTime,
    endTime: startTime && endTime && endTime > startTime ? endTime : undefined,
  };
}

function sortPlannerEntries(entries: PlannerEntry[]) {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const timeComparison = compareTimeValues(a.entry.startTime, b.entry.startTime);
      if (timeComparison !== 0) return timeComparison;

      const endComparison = compareTimeValues(a.entry.endTime, b.entry.endTime);
      if (endComparison !== 0) return endComparison;

      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

function formatDisplayTime(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatTimeSlotLabel(startTime?: string, endTime?: string) {
  const startLabel = formatDisplayTime(startTime);
  const endLabel = formatDisplayTime(endTime);

  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  if (startLabel) return startLabel;
  return 'Set time';
}

function loadPlannerEntries(): PlannerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PLANNER_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortPlannerEntries(parsed.map(normalizePlannerEntry).filter((entry): entry is PlannerEntry => Boolean(entry)));
  } catch {
    return [];
  }
}

function savePlannerEntries(entries: PlannerEntry[]) {
  try {
    localStorage.setItem(PLANNER_ITEMS_STORAGE_KEY, JSON.stringify(entries));
  } catch { }
}

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PLANNER_DISMISSED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(PLANNER_DISMISSED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch { }
}

function hasScheduledTime(entry: PlannerEntry) {
  return Boolean(entry.startTime);
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

const AREA_ICONS: Record<string, React.JSX.Element> = {
  career: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="10" rx="2" />
      <path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2" />
      <path d="M10 13h4" />
    </svg>
  ),
  health: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16" />
      <path d="M4 12h16" />
    </svg>
  ),
  finances: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10" />
    </svg>
  ),
  relationships: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10a4 4 0 110-8 4 4 0 010 8z" />
      <path d="M17 12a3 3 0 110-6 3 3 0 010 6z" />
      <path d="M3 22v-1.5A5.5 5.5 0 018.5 15H10" />
      <path d="M14 22v-1a5 5 0 015-5h1" />
    </svg>
  ),
  growth: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20c3-6 5-9 7-9s3 2 7 9" />
      <path d="M12 11V4" />
      <path d="M10 6l2-2 2 2" />
    </svg>
  ),
  recreation: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19l7-14 7 14H5z" />
      <path d="M9 15h6" />
    </svg>
  ),
  home: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h6V4H4v5zM14 9h6V4h-6v5zM4 20h6v-5H4v5zM14 20h6v-5h-6v5z" />
    </svg>
  ),
  default: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h6V4H4v5zM14 9h6V4h-6v5zM4 20h6v-5H4v5zM14 20h6v-5h-6v5z" />
    </svg>
  )
};

function getTaskArea(task: Task, tasks: Task[]) {
  const path = getTaskPath(tasks, task.id);
  const areaTask = path[0];
  const areaKey = resolveAreaKey(areaTask?.title || 'default');
  return {
    areaKey,
    areaLabel: areaTask?.title || 'Task',
  };
}

function getImmediateParentLabel(task: Task, tasks: Task[]): string | null {
  const parent = tasks.find(candidate => candidate.id === task.parentId);
  if (!parent || parent.parentId === ROOT_TASK_ID) return null;
  return parent.title;
}

function getPlannerPillLabel(task: Task, tasks: Task[]): string | null {
  const path = getTaskPath(tasks, task.id);
  if (path.some(candidate => candidate.title === 'Watch Movies/Shows')) {
    return 'Watch Movies/Shows';
  }
  return null;
}

function shouldRenderAsPlannerPill(task: Task | null, tasks: Task[]): boolean {
  if (!task) return false;
  return Boolean(task.recurrence) || Boolean(getPlannerPillLabel(task, tasks));
}

function renderParentIndicator(label: string, className: string) {
  if (label === 'Read a Book') {
    return (
      <span className={`inline-flex items-center justify-center self-center ${className}`} title={label} aria-label={label}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </span>
    );
  }

  if (label === 'Watch Movies/Shows') {
    return (
      <span className={`inline-flex items-center justify-center self-center ${className}`} title={label} aria-label={label}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <path d="M17 2l-5 5-5-5" />
        </svg>
      </span>
    );
  }

  return <span className={className}>{label}</span>;
}

// ─── Recurrence Day Editor ───────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Convert any recurrence rule to its corresponding day-of-week numbers */
function recurrenceToDays(rec?: TaskRecurrence): number[] {
  if (!rec) return [];
  switch (rec.rule) {
    case 'daily': return [0, 1, 2, 3, 4, 5, 6];
    case 'weekdays': return [1, 2, 3, 4, 5];
    case 'weekends': return [0, 6];
    case 'mwf': return [1, 3, 5];
    case 'tth': return [2, 4];
    case 'custom': return rec.daysOfWeek ?? [];
  }
  return [];
}

function RecurrenceEditor({
  task,
  tasks,
  anchorRect,
  onSave,
  onClose,
}: {
  task: Task;
  tasks: Task[];
  anchorRect: DOMRect;
  onSave: (recurrence: TaskRecurrence) => void;
  onClose: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>(() => recurrenceToDays(task.recurrence));
  const panelRef = useRef<HTMLDivElement>(null);
  const { areaKey } = useMemo(() => getTaskArea(task, tasks), [task, tasks]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = () => {
    const rec: TaskRecurrence = { rule: 'custom', daysOfWeek: selectedDays };
    onSave(rec);
  };

  // Position below the anchor chip
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 6,
    left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - 280)),
    zIndex: 50,
    width: 264,
  };

  return (
    <div ref={panelRef} style={style} className="rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{AREA_ICONS[areaKey] || AREA_ICONS.default}</span>
          <span className="text-[13px] font-medium text-slate-200 truncate">{task.title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Day toggles */}
      <div className="px-3.5 pb-2.5">
        <div className="flex gap-1">
          {DAY_LABELS.map((dayLabel, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold tracking-wide transition-all ${
                selectedDays.includes(idx)
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:text-slate-400 hover:border-slate-600'
              }`}
            >
              {dayLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="px-3.5 pb-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={selectedDays.length === 0}
          className="w-full py-1.5 rounded-lg text-[12px] font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function TimeSlotEditor({
  entry,
  anchorRect,
  onSave,
  onClear,
  onClose,
}: {
  entry: PlannerEntry;
  anchorRect: DOMRect;
  onSave: (startTime: string, endTime?: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [startTime, setStartTime] = useState(entry.startTime || '');
  const [endTime, setEndTime] = useState(entry.endTime || '');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasInvalidRange = Boolean(startTime && endTime && endTime <= startTime);
  const panelWidth = 264;
  const filesDrawer = typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>('[data-files-drawer][data-open="true"]')
    : null;
  const maxRight = filesDrawer
    ? filesDrawer.getBoundingClientRect().left - 8
    : window.innerWidth - 8;
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 6,
    left: Math.max(8, Math.min(anchorRect.left, maxRight - panelWidth)),
    zIndex: 60,
    width: panelWidth,
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div ref={panelRef} style={style} className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Time Slot</p>
          <p className="mt-1 truncate text-[13px] font-medium text-slate-200">{entry.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3.5 pb-2.5">
        <label className="text-[11px] text-slate-400">
          <span className="mb-1 block">Start</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-[12px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          <span className="mb-1 block">End</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-[12px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </label>
      </div>

      {hasInvalidRange && (
        <p className="px-3.5 pb-2 text-[11px] text-amber-300">End time must be later than start time.</p>
      )}

      <div className="flex items-center gap-2 px-3.5 pb-3">
        <button
          type="button"
          onClick={() => onSave(startTime, endTime || undefined)}
          disabled={!startTime || hasInvalidRange}
          className="flex-1 rounded-lg bg-blue-500/20 py-1.5 text-[12px] font-medium text-blue-300 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!entry.startTime && !entry.endTime}
          className="rounded-lg border border-slate-700/60 px-3 py-1.5 text-[12px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Sortable Row ────────────────────────────────────────────────────────────

function SortablePlannerRow({
  entry,
  parentLabel,
  areaKey,
  areaLabel,
  areaBadge,
  timeSlotLabel,
  onToggle,
  onRemove,
  onNavigate,
  onEditTimeSlot,
}: {
  entry: PlannerEntry;
  parentLabel: string | null;
  areaKey: string;
  areaLabel: string;
  areaBadge: string;
  timeSlotLabel: string;
  onToggle: () => void;
  onRemove: () => void;
  onNavigate: () => void;
  onEditTimeSlot: (event: React.MouseEvent<HTMLButtonElement>) => void;
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
  const isTimedEntry = hasScheduledTime(entry);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/row flex gap-3 px-4 py-2.5 border-b border-slate-800/40 last:border-b-0 transition-all ${isTimedEntry ? 'items-start' : 'items-center'} ${isDragging
        ? 'opacity-50 bg-slate-800/40 z-10 shadow-lg rounded-lg'
        : 'hover:bg-slate-800/30'
        }`}
    >
      {/* Drag handle area — invisible, whole row drags on hover via the grip zone */}
      <div
        {...attributes}
        {...listeners}
        className={`flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-40 transition-opacity ${isTimedEntry ? 'mt-0.5' : ''}`}
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
        className={`flex-shrink-0 w-4 h-4 rounded-[5px] border-[1.5px] transition-all flex items-center justify-center ${isTimedEntry ? 'mt-0.5' : ''} ${entry.completed
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
        className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
        onClick={onNavigate}
      >
        {isTimedEntry ? (
          <div className="min-w-0 flex-1 space-y-1.5">
            <span
              className={`block truncate leading-snug transition-all text-[13px] ${
                entry.completed
                  ? 'text-slate-500 line-through'
                  : 'text-slate-100'
              }`}
            >
              {entry.label}
            </span>
            <div className={`flex min-w-0 items-center gap-3 ${parentLabel ? 'justify-between' : 'justify-start'}`}>
              {parentLabel && (
                <div className="min-w-0 flex-1">
                  {renderParentIndicator(parentLabel, 'block truncate text-[11px] text-slate-500')}
                </div>
              )}
              <span className="flex-shrink-0 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">
                {timeSlotLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span
              className={`leading-snug block truncate transition-all text-[13px] ${
                entry.completed
                  ? 'text-slate-500 line-through'
                  : 'text-slate-100'
              }`}
            >
              {entry.label}
            </span>
            {parentLabel && (
              renderParentIndicator(parentLabel, 'flex-shrink-0 text-[11px] text-slate-500')
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onEditTimeSlot}
        title={timeSlotLabel}
        aria-label={`Edit time slot for ${entry.label}: ${timeSlotLabel}`}
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${isTimedEntry ? 'self-start mt-0.5' : ''} ${
          hasScheduledTime(entry)
            ? 'border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15'
            : 'border-slate-700/60 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
        }`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
        </svg>
      </button>

      {/* Area badge */}
      {areaLabel && areaLabel !== 'Task' && (
        <span 
          className={`flex-shrink-0 flex items-center justify-center p-1.5 rounded-md ${isTimedEntry ? 'self-start mt-0.5' : ''} ${areaBadge}`}
          title={areaLabel}
        >
          {AREA_ICONS[areaKey] || AREA_ICONS.default}
        </span>
      )}

      {/* Remove icon */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={`flex-shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-slate-600 hover:text-red-400 ${isTimedEntry ? 'self-start mt-1.5' : ''}`}
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
  const isTimedEntry = hasScheduledTime(entry);

  return (
    <div className={`flex gap-3 px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-lg shadow-2xl backdrop-blur-sm ${isTimedEntry ? 'items-start' : 'items-center'}`}>
      <div className={`w-4 h-4 rounded-[5px] border-[1.5px] ${entry.completed
        ? 'bg-emerald-500/80 border-emerald-500/80'
        : 'border-slate-500'
        }`} />
      {isTimedEntry ? (
        <div className="min-w-0 flex flex-col gap-1">
          <span className="truncate text-[13px] text-slate-200">{entry.label}</span>
          <span className="w-fit rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">
            {formatTimeSlotLabel(entry.startTime, entry.endTime)}
          </span>
        </div>
      ) : (
        <span className="text-[13px] text-slate-200">{entry.label}</span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PlannerCard({ tasks, navigateTo, selectTask, createTask, updateTask }: PlannerCardProps) {
  const [entries, setEntries] = useState<PlannerEntry[]>(() => loadPlannerEntries());
  const [draft, setDraft] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingRecurrence, setEditingRecurrence] = useState<{ task: Task; rect: DOMRect } | null>(null);
  const [editingTimeSlot, setEditingTimeSlot] = useState<{ entryId: string; rect: DOMRect } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Clear planner state on daily rollover
  useEffect(() => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const storedDate = typeof window !== 'undefined' ? localStorage.getItem(PLANNER_DATE_STORAGE_KEY) : todayStr;

    setEntries(prev => {
      if (storedDate !== todayStr && typeof window !== 'undefined') {
        localStorage.setItem(PLANNER_DATE_STORAGE_KEY, todayStr);
        saveDismissedIds(new Set());
        return [];
      }
      return prev;
    });
  }, []);

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
        return sortPlannerEntries([...prev, { id: buildId(), taskId: t.id, label: t.title, completed: false }]);
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
    setEntries(prev => sortPlannerEntries([
      ...prev,
      {
        id: buildId(),
        taskId: task.id,
        label: task.title,
        completed: false,
      },
    ]));
    setDraft('');
    setShowDropdown(false);
    setHighlightIndex(-1);
  }, []);

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

    setEntries(prev => sortPlannerEntries([
      ...prev,
      {
        id: buildId(),
        taskId: newTask.id,
        label: trimmed,
        completed: false,
      },
    ]));
    setDraft('');
    setShowDropdown(false);
    setHighlightIndex(-1);
  }, [createTask]);

  const toggleEntry = useCallback((entryId: string) => {
    setEntries(prev =>
      sortPlannerEntries(prev.map(e => (e.id === entryId ? { ...e, completed: !e.completed } : e)))
    );
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setEntries(prev => {
      const entry = prev.find(e => e.id === entryId);
      // If it's a recurring task, remember the dismissal for the rest of the day
      if (entry?.taskId) {
        const linkedTask = tasks.find(t => t.id === entry.taskId);
        if (linkedTask?.recurrence) {
          const dismissed = loadDismissedIds();
          dismissed.add(entry.taskId);
          saveDismissedIds(dismissed);
        }
      }
      return prev.filter(e => e.id !== entryId);
    });
  }, [tasks]);

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
      return sortPlannerEntries(arrayMove(prev, oldIndex, newIndex));
    });
  };

  const dragEntry = dragId ? entries.find(e => e.id === dragId) : null;
  const editingTimeSlotEntry = editingTimeSlot ? entries.find(entry => entry.id === editingTimeSlot.entryId) || null : null;

  const updateEntryTimeSlot = useCallback((entryId: string, startTime?: string, endTime?: string) => {
    setEntries(prev => sortPlannerEntries(prev.map(entry => (
      entry.id === entryId
        ? {
          ...entry,
          startTime,
          endTime,
        }
        : entry
    ))));
  }, []);

  // ─── Stats ───────────────────────────────────────────────────────────────

  const completedCount = entries.filter(e => e.completed).length;
  const totalCount = entries.length;

  // ─── Render ──────────────────────────────────────────────────────────────

  const routineEntries: PlannerEntry[] = [];
  const standardEntries: PlannerEntry[] = [];

  entries.forEach(e => {
    const linkedTask = e.taskId ? tasks.find(t => t.id === e.taskId) : null;
    if (!hasScheduledTime(e) && shouldRenderAsPlannerPill(linkedTask, tasks)) {
      routineEntries.push(e);
    } else {
      standardEntries.push(e);
    }
  });

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
                const { areaKey, areaLabel } = getTaskArea(task, tasks);
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
                      <span className={`flex-shrink-0 p-1 rounded ${areaBadge}`} title={areaLabel}>
                        {AREA_ICONS[areaKey] || AREA_ICONS.default}
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
      
      {/* Routine/Calendar Tasks (Chips) */}
      {routineEntries.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {routineEntries.map(entry => {
            const linkedTask = entry.taskId ? tasks.find(t => t.id === entry.taskId) : null;
            const areaKey = linkedTask ? getTaskArea(linkedTask, tasks).areaKey : 'default';
            const pillLabel = linkedTask ? getPlannerPillLabel(linkedTask, tasks) : null;
            const opensRecurrenceEditor = Boolean(linkedTask?.recurrence);
            return (
              <div
                key={entry.id}
                className={`group/chip flex items-center rounded-lg border border-slate-700/60 transition-colors bg-slate-800/40 ${entry.completed ? 'opacity-40' : ''}`}
              >
                {/* Clickable pill body → opens recurrence editor */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (!linkedTask) return;
                    if (opensRecurrenceEditor) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setEditingRecurrence({ task: linkedTask, rect });
                      return;
                    }
                    navigateTo(linkedTask.parentId);
                    selectTask(linkedTask.id);
                  }}
                  title={opensRecurrenceEditor ? 'Edit recurrence' : 'Open task'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer hover:bg-blue-500/15 rounded-l-lg transition-colors"
                >
                  <span className="text-slate-400 group-hover/chip:text-blue-400 transition-colors">
                    {pillLabel ? renderParentIndicator(pillLabel, 'flex') : (AREA_ICONS[areaKey] || AREA_ICONS.default)}
                  </span>
                  <span className="text-[11px] font-medium text-slate-300 group-hover/chip:text-blue-200 transition-colors">
                    {entry.label}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setEditingTimeSlot({ entryId: entry.id, rect });
                  }}
                  title="Set time slot"
                  className="px-2 py-1.5 text-slate-500 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
                  </svg>
                </button>
                {/* Dismiss (X) button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEntry(entry.id);
                  }}
                  title="Dismiss"
                  className="px-1.5 py-1.5 opacity-0 group-hover/chip:opacity-100 text-slate-500 hover:text-red-400 transition-all rounded-r-lg hover:bg-red-500/10"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Recurrence Editor Popover */}
      {editingRecurrence && (
        <RecurrenceEditor
          task={editingRecurrence.task}
          tasks={tasks}
          anchorRect={editingRecurrence.rect}
          onClose={() => setEditingRecurrence(null)}
          onSave={async (rec) => {
            await updateTask(editingRecurrence.task.id, { recurrence: rec });
            setEditingRecurrence(null);
          }}
        />
      )}

      {editingTimeSlot && editingTimeSlotEntry && (
        <TimeSlotEditor
          entry={editingTimeSlotEntry}
          anchorRect={editingTimeSlot.rect}
          onClose={() => setEditingTimeSlot(null)}
          onSave={(startTime, endTime) => {
            updateEntryTimeSlot(editingTimeSlot.entryId, startTime, endTime);
            setEditingTimeSlot(null);
          }}
          onClear={() => {
            updateEntryTimeSlot(editingTimeSlot.entryId, undefined, undefined);
            setEditingTimeSlot(null);
          }}
        />
      )}

      {/* Standard Task List */}
      {standardEntries.length === 0 ? (
        <div className="px-5 pb-5 pt-1">
          <p className="text-[13px] text-slate-600">
            {routineEntries.length > 0 ? "Add standard tasks for your day." : "Add tasks to start planning your day."}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={standardEntries.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="border-t border-slate-800/60">
              {standardEntries.map(entry => {
                const linkedTask = entry.taskId
                  ? tasks.find(t => t.id === entry.taskId) || null
                  : null;
                const { areaKey, areaLabel } = linkedTask
                  ? getTaskArea(linkedTask, tasks)
                  : { areaKey: 'default', areaLabel: 'Task' };
                const areaBadge = AREA_BADGES[areaKey] || AREA_BADGES.default;
                const parentLabel = linkedTask ? getImmediateParentLabel(linkedTask, tasks) : null;

                return (
                  <SortablePlannerRow
                    key={entry.id}
                    entry={entry}
                    parentLabel={parentLabel}
                    areaKey={areaKey}
                    areaLabel={areaLabel}
                    areaBadge={areaBadge}
                    timeSlotLabel={formatTimeSlotLabel(entry.startTime, entry.endTime)}
                    onToggle={() => toggleEntry(entry.id)}
                    onRemove={() => removeEntry(entry.id)}
                    onNavigate={() => {
                      if (linkedTask) {
                        navigateTo(linkedTask.parentId);
                        selectTask(linkedTask.id);
                      }
                    }}
                    onEditTimeSlot={(event) => {
                      event.stopPropagation();
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                      setEditingTimeSlot({ entryId: entry.id, rect });
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
