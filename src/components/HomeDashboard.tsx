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
import { useTravelMode } from '@/lib/travel-mode-context';
import { COLUMNS, ROOT_TASK_ID, Task, TaskStatus } from '@/lib/types';
import { computeTaskImportance, getSuggestedNextTask } from '@/lib/tasks';

import { resolveAreaKey } from '@/lib/utils';
import { PlannerCard } from './PlannerCard';
import { GlobalTray } from './GlobalTray';
import { FileSystemDrawer } from './FileSystemDrawer';
import { TaskStatusRing } from './TaskStatusRing';
import { HierarchyModal } from './HierarchyModal';
import { TravelModeHomeDashboard } from './TravelModeHomeDashboard';

type DragHandleProps = {
  ref: (el: HTMLElement | null) => void;
  listeners?: ReturnType<typeof useSortable>['listeners'];
  attributes?: ReturnType<typeof useSortable>['attributes'];
};

type AreaSnapshot = {
  area: Task;
  tasks: Task[];
  leafTasks: Task[];
  statusCounts: Record<TaskStatus, number>;
  total: number;
  activeCount: number;
  weekCount: number;
  recurringCount: number;
  dueSoon: boolean;
  highlights: Task[];
  nextSuggestion?: Task;
  calloutTaskData?: Task | null;
  taskMap: Map<string, Task>;
};

type AreaActivitySummary = {
  area: Task;
  score: number;
  completedToday: number;
  updatedToday: number;
  reason: string;
};

type AreaAttentionKind = 'overdue' | 'dueSoon' | 'onHold' | 'neglected';

type AreaAttentionSummary = {
  area: Task;
  score: number;
  kind: AreaAttentionKind;
  reason: string;
};

type FocusSuggestion = {
  area: Task;
  task: Task;
  score: number;
  reason: string;
};

type DashboardAnalysis = {
  mostActiveToday: AreaActivitySummary | null;
  needsAttention: AreaAttentionSummary | null;
  suggestedFocus: FocusSuggestion[];
};

const DEFAULT_AREA_ICON = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M4 9h6V4H4v5zM14 9h6V4h-6v5zM4 20h6v-5H4v5zM14 20h6v-5h-6v5z" />
  </svg>
);

const DEFAULT_AREA_GRADIENT = {
  gradient: 'linear-gradient(135deg, #253040 0%, #141c28 100%)',
  iconBg: 'bg-slate-400/20',
  ringTrack: 'rgba(148,163,184,0.2)',
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
      <path d="M12 7v10" />
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
  admin: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  ),
  recreation: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19l7-14 7 14H5z" />
      <path d="M9 15h6" />
    </svg>
  ),
};

const AREA_GRADIENTS: Record<string, { gradient: string; iconBg: string; ringTrack: string; titleColor?: string; subtitleColor?: string; ringEmptyColor?: string; ringTextColor?: string }> = {
  career: { gradient: 'linear-gradient(135deg, #1a3a6b 0%, #0c1f3d 100%)', iconBg: 'bg-blue-500/25', ringTrack: 'rgba(59,130,246,0.25)' },
  health: { gradient: 'linear-gradient(135deg, #0e7490 0%, #164e63 100%)', iconBg: 'bg-cyan-400/25', ringTrack: 'rgba(6,182,212,0.25)' },
  finances: { gradient: 'linear-gradient(135deg, #14532d 0%, #052e16 100%)', iconBg: 'bg-green-500/25', ringTrack: 'rgba(34,197,94,0.25)' },
  relationships: { gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', iconBg: 'bg-red-400/25', ringTrack: 'rgba(248,113,113,0.35)' },
  growth: { gradient: 'linear-gradient(135deg, #701a75 0%, #4a044e 100%)', iconBg: 'bg-fuchsia-500/25', ringTrack: 'rgba(217,70,239,0.25)' },
  admin: { gradient: 'linear-gradient(135deg, #ca8a04 0%, #854d0e 100%)', iconBg: 'bg-yellow-400/25', ringTrack: 'rgba(250,204,21,0.28)' },
  recreation: { gradient: 'linear-gradient(135deg, #c2410c 0%, #7c2d12 100%)', iconBg: 'bg-orange-500/25', ringTrack: 'rgba(249,115,22,0.25)' },
  home: { gradient: 'linear-gradient(135deg, #2d4a3e 0%, #162620 100%)', iconBg: 'bg-teal-500/25', ringTrack: 'rgba(20,184,166,0.25)' },
};

import { useBirthdays } from '@/lib/birthdays';

function isDueWithinThreeDays(task: Task): boolean {
  if (!task.dueDate || task.status === 'COMPLETED') return false;
  const now = new Date().getTime();
  const diffDays = (task.dueDate.getTime() - now) / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}

function isSameLocalDay(date: Date | undefined, now: Date): boolean {
  if (!date) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getAreaMeta(area: Pick<Task, 'id' | 'title'>) {
  const toneKey = resolveAreaKey(area.title || area.id || '');
  return {
    toneKey,
    icon: LIFE_AREA_ICONS[toneKey] || DEFAULT_AREA_ICON,
    grad: AREA_GRADIENTS[toneKey] || DEFAULT_AREA_GRADIENT,
  };
}

function getImmediateParentLabel(task: Task, taskMap: Map<string, Task>): string | null {
  const parent = taskMap.get(task.parentId);
  if (!parent || parent.parentId === ROOT_TASK_ID) return null;
  return parent.title;
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

function formatCount(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function getAreaActivitySummary(snapshot: AreaSnapshot, now: Date): AreaActivitySummary | null {
  const relevantTasks = snapshot.tasks.filter(task => !task.calendarOnly);
  let completedToday = 0;
  let updatedToday = 0;

  relevantTasks.forEach(task => {
    if (isSameLocalDay(task.completedAt, now)) {
      completedToday += 1;
      return;
    }

    if (isSameLocalDay(task.updatedAt, now)) {
      updatedToday += 1;
    }
  });

  const score = completedToday * 3 + updatedToday;
  if (score === 0) return null;

  const reasonParts: string[] = [];
  if (completedToday > 0) reasonParts.push(formatCount(completedToday, 'completed task'));
  if (updatedToday > 0) reasonParts.push(formatCount(updatedToday, 'updated task'));

  return {
    area: snapshot.area,
    score,
    completedToday,
    updatedToday,
    reason: `${reasonParts.join(', ')} today`,
  };
}

function getAreaAttentionSummary(snapshot: AreaSnapshot, now: Date): AreaAttentionSummary | null {
  const openLeafTasks = snapshot.leafTasks.filter(task => !task.calendarOnly && task.status !== 'COMPLETED');
  if (openLeafTasks.length === 0) return null;

  const threeDayWindow = new Date(now);
  threeDayWindow.setDate(now.getDate() + 3);
  const weekWindow = new Date(now);
  weekWindow.setDate(now.getDate() + 7);

  const overdueCount = openLeafTasks.filter(task => task.dueDate && task.dueDate < now).length;
  const dueSoonCount = openLeafTasks.filter(task => task.dueDate && task.dueDate >= now && task.dueDate <= threeDayWindow).length;
  const onHoldCount = openLeafTasks.filter(task => task.status === 'ON_HOLD').length;
  const hasInProgressTask = openLeafTasks.some(task => task.status === 'IN_PROGRESS');
  const hasPendingImportantTask = !hasInProgressTask && openLeafTasks.some(task =>
    task.priority === 'HIGH' ||
    Boolean(task.dueDate && task.dueDate <= weekWindow) ||
    computeTaskImportance(task) >= 20
  );

  const score = overdueCount * 4 + dueSoonCount * 2 + onHoldCount * 2 + (hasPendingImportantTask ? 1 : 0);
  if (score === 0) return null;

  if (overdueCount > 0) {
    return {
      area: snapshot.area,
      score,
      kind: 'overdue',
      reason: `${snapshot.area.title} has ${formatCount(overdueCount, 'overdue task')}`,
    };
  }

  if (dueSoonCount > 0) {
    return {
      area: snapshot.area,
      score,
      kind: 'dueSoon',
      reason: `${snapshot.area.title} has ${formatCount(dueSoonCount, 'task')} due soon`,
    };
  }

  if (onHoldCount > 0) {
    return {
      area: snapshot.area,
      score,
      kind: 'onHold',
      reason: `${snapshot.area.title} has ${formatCount(onHoldCount, 'task')} on hold`,
    };
  }

  return {
    area: snapshot.area,
    score,
    kind: 'neglected',
    reason: `${snapshot.area.title} has important work with no active momentum`,
  };
}

function getSuggestedFocusReason(task: Task, now: Date): string {
  const weekWindow = new Date(now);
  weekWindow.setDate(now.getDate() + 7);

  if (task.dueDate && task.dueDate < now) return 'overdue';
  if (task.dueDate && task.dueDate <= weekWindow) return 'due this week';

  const staleDays = (now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (task.status === 'ON_HOLD' || staleDays > 7) return 'stalled';
  if (task.priority === 'HIGH') return 'high priority';

  return 'easy win';
}

function getSuggestedFocusAreas(
  snapshots: AreaSnapshot[],
  mostActiveAreaId: string | null,
  lifeAreaOrder: Map<string, number>,
  now: Date
): FocusSuggestion[] {
  const suggestions = snapshots
    .map(snapshot => {
      const eligibleTasks = snapshot.tasks.filter(task => !task.calendarOnly);
      if (eligibleTasks.length === 0) return null;

      const task = getSuggestedNextTask(eligibleTasks, snapshot.area.id);
      if (!task || task.status === 'COMPLETED' || task.calendarOnly) return null;

      const attention = getAreaAttentionSummary(snapshot, now);
      const score = computeTaskImportance(task) + (attention?.score || 0) + (task.priority === 'HIGH' ? 2 : 0);

      return {
        area: snapshot.area,
        task,
        score,
        reason: getSuggestedFocusReason(task, now),
      };
    })
    .filter((candidate): candidate is FocusSuggestion => Boolean(candidate))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (lifeAreaOrder.get(a.area.id) ?? Number.MAX_SAFE_INTEGER) - (lifeAreaOrder.get(b.area.id) ?? Number.MAX_SAFE_INTEGER);
    });

  if (suggestions.length > 1 && mostActiveAreaId && suggestions[0]?.area.id === mostActiveAreaId) {
    const alternateIndex = suggestions.findIndex(suggestion => suggestion.area.id !== mostActiveAreaId);
    if (alternateIndex > 0) {
      const [alternate] = suggestions.splice(alternateIndex, 1);
      suggestions.unshift(alternate);
    }
  }

  return suggestions.slice(0, 3);
}

function LifeAreaCard({
  area,
  statusCounts,
  total,
  dueSoon,
  highlights = [],
  taskMap,
  nextSuggestion,
  calloutTaskData,
  onOpen,
  onEdit,
  onHierarchy,
  onCalloutClick,
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
  highlights?: Task[];
  taskMap: Map<string, Task>;
  nextSuggestion?: Task;
  calloutTaskData?: Task | null;
  onOpen: () => void;
  onEdit?: () => void;
  onHierarchy?: () => void;
  onCalloutClick?: (task: Task) => void;
  cardRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
  muted?: boolean;
  isActive?: boolean;
}) {
  const { getUpcomingBirthday } = useBirthdays();
  const { toneKey, icon, grad } = getAreaMeta(area);

  const calloutTask = nextSuggestion || highlights[0];
  const upcomingBirthday = toneKey === 'relationships' ? getUpcomingBirthday() : null;


  return (
    <div
      ref={cardRef}
      onClick={onOpen}
      {...(dragHandleProps?.attributes || {})}
      {...(dragHandleProps?.listeners || {})}
      className={`group relative overflow-hidden flex flex-col rounded-2xl text-left transition-all select-none ${isDragging ? 'ring-2 ring-white/20 shadow-2xl scale-[1.02]' : 'hover:shadow-xl hover:-translate-y-0.5'
        } ${isActive ? 'ring-1 ring-white/10' : ''} ${muted ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}
      style={{
        ...(style || {}),
        background: grad.gradient,
        minHeight: '180px',
      }}
    >
      {/* Top row: icon + title | edit button */}
      <div className="flex items-start justify-between p-4 pb-0">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 ${grad.iconBg} ${!grad.iconBg.includes('text-') ? 'text-white/80' : ''}`}>
            {icon}
          </div>
          <h3 className={`text-[15px] font-semibold leading-tight ${grad.titleColor || 'text-white'}`}>{area.title}</h3>
          {dueSoon && (
            <span className="inline-flex items-center rounded-full bg-red-500/10 text-red-400 dark:text-red-400 p-1.5" title="Due soon">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a1 1 0 01.894.553l9 18A1 1 0 0121 22H3a1 1 0 01-.894-1.447l9-18A1 1 0 0112 2zm0 6a1 1 0 00-1 1v4a1 1 0 001 1h.01a1 1 0 001-1V9a1 1 0 00-1.01-1zM12 17a1.25 1.25 0 100-2.5A1.25 1.25 0 0012 17z" />
              </svg>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onHierarchy && (
            <button
              onClick={(e) => { e.stopPropagation(); onHierarchy(); }}
              className={`flex-shrink-0 h-7 w-7 rounded-lg grid place-items-center transition-colors ${grad.titleColor ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50' : 'text-white/30 hover:text-white/70 hover:bg-white/10'}`}
              title="View Hierarchy"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`flex-shrink-0 h-7 w-7 rounded-lg grid place-items-center transition-colors ${grad.titleColor ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50' : 'text-white/30 hover:text-white/70 hover:bg-white/10'}`}
              title="Edit Area"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Middle: highlight tasks */}
      <div className="flex-1 px-4 pt-3 pb-2 flex flex-col justify-center">
        {highlights.length > 0 ? (
          <div className="flex flex-col gap-1">
            {highlights.slice(0, 3).map((task) => {
              const parentLabel = getImmediateParentLabel(task, taskMap);
              return (
                <div key={task.id} className={`flex items-baseline gap-1.5 min-w-0 ${grad.subtitleColor || 'text-white/60'}`}>
                  <span className="truncate text-[13px] leading-snug">{task.title}</span>
                  {parentLabel && (
                    renderParentIndicator(parentLabel, 'flex-shrink-0 text-[11px] text-white/40')
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className={`text-[13px] ${grad.ringEmptyColor || 'text-white/30'}`}>No active focus.</p>
        )}
      </div>

      {/* Bottom row: action hint | donut ring */}
      <div className="flex items-end justify-between p-4 pt-0">
        {/* "Next:" callout and Birthday Pill */}
        <div className="min-w-0 flex-1 flex flex-col items-start gap-1.5">
          {calloutTask && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (calloutTaskData && onCalloutClick) {
                  onCalloutClick(calloutTaskData);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] max-w-full truncate transition-colors border ${grad.titleColor ? 'bg-slate-100/50 text-slate-500 hover:bg-slate-200/50 border-transparent' : 'bg-white/[0.07] backdrop-blur-sm text-white/50 hover:bg-white/[0.12] border-white/5'}`}
            >
              <span className={`flex-shrink-0 ${grad.titleColor ? 'text-slate-500' : 'text-white/60'}`}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </span>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate">{calloutTask.title}</span>
                {(() => {
                  const parentLabel = getImmediateParentLabel(calloutTask, taskMap);
                  return parentLabel
                    ? renderParentIndicator(parentLabel, `flex-shrink-0 text-[10px] ${grad.titleColor ? 'text-slate-400' : 'text-white/40'}`)
                    : null;
                })()}
              </span>
            </button>
          )}
          {upcomingBirthday && (
            <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] max-w-full truncate transition-colors border ${grad.titleColor ? 'bg-rose-100/50 text-rose-600 border-rose-200' : 'bg-red-500/20 text-red-200 border-red-500/30 backdrop-blur-sm'}`}>
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="4" rx="1" />
                <path d="M12 8v13" />
                <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
              </svg>
              <span className="truncate font-medium">{upcomingBirthday}</span>
            </div>
          )}
        </div>

        {/* Task count donut */}
        <div className="relative flex-shrink-0 ml-3 flex items-center justify-center" style={{ width: 72, height: 72 }}>
          <svg width={72} height={72} viewBox="0 0 72 72" className="absolute inset-0 pointer-events-none">
            <circle
              cx={36}
              cy={36}
              r={33}
              stroke={grad.ringTrack}
              strokeWidth={6}
              fill="none"
            />
          </svg>
          <TaskStatusRing
            data={{
              notStarted: statusCounts['NOT_STARTED'] || 0,
              inProgress: statusCounts['IN_PROGRESS'] || 0,
              onHold: statusCounts['ON_HOLD'] || 0,
              completed: statusCounts['COMPLETED'] || 0,
            }}
            size={72}
            innerRadius={30}
            outerRadius={36}
            className={`absolute inset-0 z-10 ${muted ? 'pointer-events-none' : ''}`}
          />
          <div className="absolute inset-[8px] rounded-full pointer-events-none bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-center z-20">
            <div className={`text-[14px] font-bold ${grad.ringTextColor || 'text-white'}`}>{total}</div>
            <div className={`text-[8px] uppercase tracking-[0.2em] ${grad.ringEmptyColor || 'text-white/40'}`}>Tasks</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableLifeAreaCard({
  snapshot,
  onOpen,
  onEdit,
  onHierarchy,
  isActive,
  onCalloutClick,
}: {
  snapshot: AreaSnapshot;
  onOpen: () => void;
  onEdit: () => void;
  onHierarchy: () => void;
  isActive: boolean;
  onCalloutClick?: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
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
      highlights={snapshot.highlights}
      nextSuggestion={snapshot.nextSuggestion}
      calloutTaskData={snapshot.calloutTaskData}
      taskMap={snapshot.taskMap}
      onOpen={onOpen}
      onEdit={onEdit}
      onHierarchy={onHierarchy}
      onCalloutClick={onCalloutClick}
      isActive={isActive}
      cardRef={setNodeRef}
      dragHandleProps={{ listeners, attributes, ref: setActivatorNodeRef }}
      style={style}
      isDragging={isDragging}
    />
  );
}



export function HomeDashboard({ isChatDrawerOpen, isChatExpanded }: { isChatDrawerOpen: boolean, isChatExpanded?: boolean }) {
  const { enabled } = useTravelMode();

  if (enabled) {
    return <TravelModeHomeDashboard />;
  }

  return <StandardHomeDashboard isChatDrawerOpen={isChatDrawerOpen} isChatExpanded={isChatExpanded} />;
}

function StandardHomeDashboard({ isChatDrawerOpen, isChatExpanded }: { isChatDrawerOpen: boolean, isChatExpanded?: boolean }) {
  const { navigateTo, tasks, createTask, reorderTasks, updateTask, deleteTask } = useTaskContext();
  const { selectTask } = useTaskContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Task | null>(null);
  const [hierarchyArea, setHierarchyArea] = useState<Task | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');

  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );





  const lifeAreas = useMemo(
    () => tasks.filter(t => t.parentId === ROOT_TASK_ID && !t.calendarOnly).sort((a, b) => a.order - b.order),
    [tasks]
  );
  const parentIdsWithChildren = useMemo(() => {
    const parentIds = new Set<string>();
    tasks.forEach(task => {
      parentIds.add(task.parentId);
    });
    return parentIds;
  }, [tasks]);

  const tasksByParentId = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      const list = map.get(t.parentId) || [];
      list.push(t);
      map.set(t.parentId, list);
    });
    return map;
  }, [tasks]);

  const taskMap = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);

  const areaSnapshots: AreaSnapshot[] = useMemo(() => {
    return lifeAreas.map(area => {
      const allAreaTasks: Task[] = [];
      const stack = [...(tasksByParentId.get(area.id) || [])];
      while (stack.length > 0) {
        const current = stack.pop()!;
        allAreaTasks.push(current);
        stack.push(...(tasksByParentId.get(current.id) || []));
      }
      const leafTasks = allAreaTasks.filter(task => !parentIdsWithChildren.has(task.id));

      const statusCounts = COLUMNS.reduce((acc, col) => {
        acc[col.status] = allAreaTasks.filter(t => t.status === col.status).length;
        return acc;
      }, {} as Record<TaskStatus, number>);

      const activeCount = allAreaTasks.filter(t => t.status !== 'COMPLETED').length;
      const recurringCount = allAreaTasks.filter(t => Boolean(t.recurrence)).length;
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);
      const weekCount = allAreaTasks.filter(t => {
        if (t.status === 'COMPLETED') return false;
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const scheduled = t.scheduledDate ? new Date(t.scheduledDate) : null;
        return Boolean((due && due <= weekEnd) || (scheduled && scheduled <= weekEnd));
      }).length;

      const dueSoon = allAreaTasks.some(isDueWithinThreeDays);

      const highlightCandidates = allAreaTasks
        .filter(t => t.status === 'IN_PROGRESS' || t.status === 'NOT_STARTED' || t.status === 'ON_HOLD')
        .filter(t => !parentIdsWithChildren.has(t.id))
        .sort((a, b) => {
          // In-progress boost
          if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
          if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;

          // Rank by computed importance
          const scoreA = computeTaskImportance(a);
          const scoreB = computeTaskImportance(b);
          if (scoreA !== scoreB) return scoreB - scoreA; // Descending

          return a.order - b.order;
        })
        .slice(0, 2);
        
      const suggestion = getSuggestedNextTask(
        allAreaTasks.filter(task => task.status !== 'ON_HOLD'),
        area.id
      );

      return {
        area,
        tasks: allAreaTasks,
        leafTasks,
        statusCounts,
        total: allAreaTasks.length,
        activeCount,
        weekCount,
        recurringCount,
        dueSoon,
        highlights: highlightCandidates,
        nextSuggestion: suggestion || undefined,
        calloutTaskData: suggestion || highlightCandidates[0] || null,
        taskMap,
      };
    });
  }, [lifeAreas, tasksByParentId, parentIdsWithChildren, taskMap]);

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

  const lifeAreaOrder = useMemo(
    () => new Map(lifeAreas.map((area, index) => [area.id, index])),
    [lifeAreas]
  );

  const dashboardAnalysis = useMemo<DashboardAnalysis>(() => {
    const now = new Date();

    const mostActiveToday = areaSnapshots
      .map(snapshot => getAreaActivitySummary(snapshot, now))
      .filter((summary): summary is AreaActivitySummary => Boolean(summary))
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.completedToday !== b.completedToday) return b.completedToday - a.completedToday;
        if (a.updatedToday !== b.updatedToday) return b.updatedToday - a.updatedToday;
        if (primaryAreaId) {
          if (a.area.id === primaryAreaId && b.area.id !== primaryAreaId) return -1;
          if (b.area.id === primaryAreaId && a.area.id !== primaryAreaId) return 1;
        }
        return (lifeAreaOrder.get(a.area.id) ?? Number.MAX_SAFE_INTEGER) - (lifeAreaOrder.get(b.area.id) ?? Number.MAX_SAFE_INTEGER);
      })[0] || null;

    const attentionPriority: Record<AreaAttentionKind, number> = {
      overdue: 0,
      dueSoon: 1,
      onHold: 2,
      neglected: 3,
    };

    const needsAttention = areaSnapshots
      .map(snapshot => getAreaAttentionSummary(snapshot, now))
      .filter((summary): summary is AreaAttentionSummary => Boolean(summary))
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (attentionPriority[a.kind] !== attentionPriority[b.kind]) {
          return attentionPriority[a.kind] - attentionPriority[b.kind];
        }
        return (lifeAreaOrder.get(a.area.id) ?? Number.MAX_SAFE_INTEGER) - (lifeAreaOrder.get(b.area.id) ?? Number.MAX_SAFE_INTEGER);
      })[0] || null;

    const suggestedFocus = getSuggestedFocusAreas(areaSnapshots, mostActiveToday?.area.id || null, lifeAreaOrder, now);

    return {
      mostActiveToday,
      needsAttention,
      suggestedFocus,
    };
  }, [areaSnapshots, lifeAreaOrder, primaryAreaId]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
    return tasks
      .filter(t => !parentIdsWithChildren.has(t.id))
      .filter(t => t.dueDate && t.status !== 'COMPLETED' && !t.calendarOnly)
      .filter(t => {
        const due = new Date(t.dueDate!);
        return due >= tomorrow && due < windowEnd;
      })
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
  }, [tasks, parentIdsWithChildren]);

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
  const addTaskToPlanner = (task: Task) => {
    const event = new CustomEvent('lifeos:planner-add', { detail: { task } });
    window.dispatchEvent(event);
  };

  // Dynamic padding for left (chat) + right (notes/files) drawers
  const leftPad = isChatDrawerOpen ? (isChatExpanded ? 'xl:pl-[600px]' : 'xl:pl-[330px]') : 'xl:pl-[56px]';
  const rightPad = isFilesDrawerOpen ? 'xl:pr-[330px]' : 'xl:pr-[56px]';

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 px-6 py-4">
        <div className={`flex items-center justify-between max-w-[1600px] mx-auto ${leftPad} ${rightPad}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="font-semibold text-white">LifeOS</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">Home</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div className="text-sm font-medium text-slate-400 hidden sm:flex items-center gap-1.5 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800/60">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-900/40 border border-slate-700/50 rounded-xl p-1 shadow-sm">
            <GlobalTray />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {/* ─── Files Drawer (RIGHT) ─── */}
        <FileSystemDrawer isOpen={isFilesDrawerOpen} setIsOpen={setIsFilesDrawerOpen} />

        <div className={`max-w-[1600px] mx-auto p-6 ${leftPad} ${rightPad}`}>
          {/* Greeting */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return 'Good morning, Rayaan';
                if (hour < 17) return 'Good afternoon, Rayaan';
                return 'Good evening, Rayaan';
              })()}
            </h1>
          </div>

          {/* ─── Two-Panel Layout ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            {/* ─── LEFT: Focus Areas ─── */}
            <div className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {(() => {
                  const summary = dashboardAnalysis.mostActiveToday;
                  const meta = summary ? getAreaMeta(summary.area) : null;
                  return (
                    <button
                      type="button"
                      disabled={!summary}
                      onClick={() => summary && navigateTo(summary.area.id)}
                      className={`rounded-2xl border border-slate-800/60 bg-slate-900/55 px-5 py-4 text-left transition-colors disabled:cursor-default ${
                        summary ? 'hover:bg-slate-900/80' : 'cursor-default'
                      }`}
                    >
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Most Active Today</p>
                      {summary && meta ? (
                        <div className="mt-4 flex items-start gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.grad.iconBg} text-white/85`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{summary.area.title}</div>
                            <p className="mt-1 text-[13px] text-slate-400">{summary.reason}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-white">No area has been active yet today</p>
                          <p className="mt-1 text-[13px] text-slate-500">Your activity will show up here once you start updating tasks.</p>
                        </div>
                      )}
                    </button>
                  );
                })()}

                {(() => {
                  const summary = dashboardAnalysis.needsAttention;
                  const meta = summary ? getAreaMeta(summary.area) : null;
                  return (
                    <button
                      type="button"
                      disabled={!summary}
                      onClick={() => summary && navigateTo(summary.area.id)}
                      className={`rounded-2xl border border-slate-800/60 bg-slate-900/55 px-5 py-4 text-left transition-colors disabled:cursor-default ${
                        summary ? 'hover:bg-slate-900/80' : 'cursor-default'
                      }`}
                    >
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Needs Attention</p>
                      {summary && meta ? (
                        <div className="mt-4 flex items-start gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.grad.iconBg} text-white/85`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{summary.area.title}</div>
                            <p className="mt-1 text-[13px] text-slate-400">{summary.reason}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-white">Nothing urgent right now</p>
                          <p className="mt-1 text-[13px] text-slate-500">No life area is currently flagging an attention signal.</p>
                        </div>
                      )}
                    </button>
                  );
                })()}

                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/55 px-5 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Suggested Focus</p>
                  {dashboardAnalysis.suggestedFocus.length === 0 ? (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-white">No focus suggestions available</p>
                      <p className="mt-1 text-[13px] text-slate-500">You have no unresolved focus candidates right now.</p>
                    </div>
                  ) : (
                    <div className="mt-3 divide-y divide-slate-800/70">
                      {dashboardAnalysis.suggestedFocus.map((suggestion) => {
                        const meta = getAreaMeta(suggestion.area);
                        const parentLabel = getImmediateParentLabel(suggestion.task, taskMap);

                        return (
                          <div key={suggestion.area.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                            <button
                              type="button"
                              onClick={() => {
                                navigateTo(suggestion.area.id);
                                selectTask(suggestion.task.id);
                              }}
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${meta.grad.iconBg} text-white/80`}>
                                  {meta.icon}
                                </span>
                                <span className="truncate">{suggestion.area.title}</span>
                              </div>
                              <div className="mt-2 flex min-w-0 items-baseline gap-1.5 text-slate-200">
                                <span className="truncate text-[13px]">{suggestion.task.title}</span>
                                {parentLabel && renderParentIndicator(parentLabel, 'flex-shrink-0 text-[11px] text-slate-500')}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">{suggestion.reason}</p>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                addTaskToPlanner(suggestion.task);
                              }}
                              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700/70 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
                              title="Add to planner"
                              aria-label={`Add ${suggestion.task.title} to planner`}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={lifeAreas.map(area => area.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {areaSnapshots.map(snapshot => (
                      <SortableLifeAreaCard
                        key={snapshot.area.id}
                        snapshot={snapshot}
                        onOpen={() => navigateTo(snapshot.area.id)}
                        onEdit={() => openEditor(snapshot.area)}
                        onHierarchy={() => setHierarchyArea(snapshot.area)}
                        isActive={primaryAreaId === snapshot.area.id}
                        onCalloutClick={addTaskToPlanner}
                      />
                    ))}
                    {lifeAreas.length === 0 && (
                      <div className="col-span-full flex items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900 py-12 text-slate-400" />
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
                      taskMap={taskMap}
                      onOpen={() => { }}
                      muted
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            {/* ─── RIGHT: Planner & Upcoming ─── */}
            <div className="space-y-5 lg:sticky lg:top-0 lg:self-start">

              {/* Planner */}
              <PlannerCard
                tasks={tasks}
                navigateTo={navigateTo}
                selectTask={selectTask}
                createTask={createTask}
                updateTask={updateTask}
              />

              {/* Upcoming */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800/60">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-medium">Upcoming</p>
                </div>
                {upcomingTasks.length === 0 ? (
                  <div className="px-4 py-5">
                    <p className="text-[13px] text-slate-500">No upcoming tasks in the next week.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {upcomingTasks.map(task => {
                      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                      const parentLabel = getImmediateParentLabel(task, taskMap);
                      const now = new Date();
                      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
                      const isTomorrow = dueDate && dueDate < tomorrow && dueDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                      const dueLabel = dueDate
                        ? dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : '';
                      const diffMs = dueDate ? dueDate.getTime() - now.getTime() : 0;
                      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                      const relativeLabel = diffDays <= 0 ? 'Today' : diffDays === 1 ? '1d' : `${diffDays}d`;

                      return (
                        <button
                          key={task.id}
                          onClick={() => {
                            navigateTo(task.parentId);
                            selectTask(task.id);
                          }}
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-800/40 transition-colors group/up"
                        >
                          <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-[4px] border-[1.5px] border-slate-600 group-hover/up:border-slate-400 transition-colors" />
                          <div className="flex-1 min-w-0">
                            <div className="flex min-w-0 items-baseline gap-1.5 text-slate-200">
                              <span className="truncate text-[13px]">{task.title}</span>
                              {parentLabel && renderParentIndicator(parentLabel, 'flex-shrink-0 text-[11px] text-slate-500')}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-slate-500">Due {dueLabel}</span>
                              {isTomorrow && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">Tomorrow</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-600 flex-shrink-0 mt-0.5">{relativeLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

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



          {hierarchyArea && (
            <HierarchyModal
              area={hierarchyArea}
              tasks={tasks}
              onClose={() => setHierarchyArea(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
