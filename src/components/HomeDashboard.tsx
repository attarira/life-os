'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getSubtreeIds, getTaskPath } from '@/lib/tasks';
import { DASHBOARD_PAGES_STORAGE_KEY } from '@/lib/storage-keys';
import { ChatPanel, AppContext } from './ChatPanel';
import { PlannerCard } from './PlannerCard';

type DragHandleProps = {
  ref: (el: HTMLElement | null) => void;
  listeners?: any;
  attributes?: any;
};

type AreaSnapshot = {
  area: Task;
  statusCounts: Record<TaskStatus, number>;
  total: number;
  activeCount: number;
  weekCount: number;
  dueSoon: boolean;
  highlights: string[];
};

type NotePage = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function buildPageId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createPage(title = 'Untitled', content = ''): NotePage {
  const nowIso = new Date().toISOString();
  return {
    id: buildPageId(),
    title,
    content,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function loadPagesState() {
  if (typeof window === 'undefined') {
    const starter = createPage();
    return { pages: [starter], activePageId: starter.id };
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_PAGES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      const hydrated = parsed.filter(Boolean) as NotePage[];
      return { pages: hydrated, activePageId: hydrated[0].id };
    }
  } catch (error) {
    console.warn('Failed to load pages:', error);
  }

  const starter = createPage();
  return { pages: [starter], activePageId: starter.id };
}

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
  recreation: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19l7-14 7 14H5z" />
      <path d="M9 15h6" />
    </svg>
  ),
};

const AREA_GRADIENTS: Record<string, { gradient: string; iconBg: string; ringTrack: string }> = {
  career: { gradient: 'linear-gradient(135deg, #1a3a6b 0%, #0c1f3d 100%)', iconBg: 'bg-blue-500/25', ringTrack: 'rgba(59,130,246,0.25)' },
  health: { gradient: 'linear-gradient(135deg, #0f5f5f 0%, #073535 100%)', iconBg: 'bg-emerald-500/25', ringTrack: 'rgba(16,185,129,0.25)' },
  finances: { gradient: 'linear-gradient(135deg, #0e5565 0%, #062e38 100%)', iconBg: 'bg-cyan-500/25', ringTrack: 'rgba(6,182,212,0.25)' },
  relationships: { gradient: 'linear-gradient(135deg, #5c1d50 0%, #33102c 100%)', iconBg: 'bg-purple-500/25', ringTrack: 'rgba(168,85,247,0.25)' },
  growth: { gradient: 'linear-gradient(135deg, #252e62 0%, #131836 100%)', iconBg: 'bg-indigo-500/25', ringTrack: 'rgba(99,102,241,0.25)' },
  recreation: { gradient: 'linear-gradient(135deg, #8a6012 0%, #4a3308 100%)', iconBg: 'bg-amber-500/25', ringTrack: 'rgba(245,158,11,0.25)' },
  home: { gradient: 'linear-gradient(135deg, #2d4a3e 0%, #162620 100%)', iconBg: 'bg-teal-500/25', ringTrack: 'rgba(20,184,166,0.25)' },
};

const AREA_BADGES: Record<string, string> = {
  career: 'bg-blue-100/70 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  health: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  finances: 'bg-cyan-100/70 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200',
  relationships: 'bg-rose-100/70 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  growth: 'bg-indigo-100/70 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  recreation: 'bg-amber-100/70 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  default: 'bg-slate-100/70 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
};

const STATUS_RING = [
  { status: 'NOT_STARTED' as TaskStatus, color: 'rgba(148,163,184,0.75)' },
  { status: 'IN_PROGRESS' as TaskStatus, color: 'rgba(56,189,248,0.75)' },
  { status: 'ON_HOLD' as TaskStatus, color: 'rgba(245,158,11,0.75)' },
  { status: 'COMPLETED' as TaskStatus, color: 'rgba(34,197,94,0.75)' },
];


function buildStatusRingSegments(
  statusCounts: Record<TaskStatus, number>,
  total: number,
  circumference: number,
  gapSize: number
) {
  if (!total) return [];

  const segments = STATUS_RING.map(({ status, color }) => {
    const count = statusCounts[status] || 0;
    if (!count) return null;
    const length = (count / total) * circumference;
    const gap = Math.min(gapSize, length * 0.6);
    return { color, length, gap };
  }).filter(Boolean) as { color: string; length: number }[];

  return segments;
}

function resolveAreaKey(id: string) {
  const key = id.toLowerCase();
  if (key.includes('home')) return 'home';
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
  activeCount,
  weekCount,
  dueSoon,
  highlights = [],
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
  activeCount: number;
  weekCount: number;
  dueSoon: boolean;
  highlights?: string[];
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
  const grad = AREA_GRADIENTS[toneKey] || { gradient: 'linear-gradient(135deg, #253040 0%, #141c28 100%)', iconBg: 'bg-slate-400/20', ringTrack: 'rgba(148,163,184,0.2)' };
  const ringSize = 72;
  const ringTrackStroke = 8;
  const ringSegmentStroke = 6;
  const ringSegmentGap = 2.2;
  const ringRadius = (ringSize - ringTrackStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringSegments = buildStatusRingSegments(statusCounts, total, ringCircumference, ringSegmentGap);

  const firstHighlight = highlights[0];

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
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${grad.iconBg} text-white/80`}>
            {icon}
          </div>
          <h3 className="text-[15px] font-semibold text-white leading-tight">{area.title}</h3>
          {dueSoon && (
            <span className="inline-flex items-center rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
              <svg className="w-2.5 h-2.5 mr-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a1 1 0 01.894.553l9 18A1 1 0 0121 22H3a1 1 0 01-.894-1.447l9-18A1 1 0 0112 2zm0 6a1 1 0 00-1 1v4a1 1 0 001 1h.01a1 1 0 001-1V9a1 1 0 00-1.01-1zM12 17a1.25 1.25 0 100-2.5A1.25 1.25 0 0012 17z" />
              </svg>
              Due soon
            </span>
          )}
        </div>
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="h-7 w-7 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 grid place-items-center transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Middle: highlight tasks */}
      <div className="flex-1 px-4 pt-3 pb-2 flex flex-col justify-center">
        {highlights.length > 0 ? (
          <div className="flex flex-col gap-1">
            {highlights.slice(0, 3).map((item, idx) => (
              <div key={idx} className="text-[13px] text-white/60 leading-snug truncate">{item}</div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-white/30">No active focus.</p>
        )}
      </div>

      {/* Bottom row: action hint | donut ring */}
      <div className="flex items-end justify-between p-4 pt-0">
        {/* "Next:" callout */}
        <div className="min-w-0 flex-1">
          {firstHighlight && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.07] backdrop-blur-sm px-2.5 py-1.5 text-[11px] text-white/50 max-w-full truncate">
              <span className="text-white/70 font-medium shrink-0">Next:</span>
              <span className="truncate">{firstHighlight}</span>
            </div>
          )}
        </div>

        {/* Task count donut */}
        <div className="relative flex-shrink-0 ml-3" style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} className="block">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              stroke={grad.ringTrack}
              strokeWidth={ringTrackStroke}
              fill="none"
            />
            {(() => {
              let offset = 0;
              const hasGaps = ringSegments.length > 1;
              return ringSegments.map((segment, index) => {
                const visibleLength = hasGaps ? Math.max(segment.length - segment.gap, 0) : segment.length;
                const dashArray = `${visibleLength} ${ringCircumference - visibleLength}`;
                const dashOffset = ringCircumference - offset;
                offset += segment.length;
                return (
                  <circle
                    key={`${segment.color}-${index}`}
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    stroke={segment.color}
                    strokeWidth={ringSegmentStroke}
                    strokeLinecap="round"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    fill="none"
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  />
                );
              });
            })()}
          </svg>
          <div className="absolute inset-[8px] rounded-full bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <div className="text-[14px] font-bold text-white">{total}</div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-white/40">Tasks</div>
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
  isActive,
}: {
  snapshot: AreaSnapshot;
  onOpen: () => void;
  onEdit: () => void;
  isActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
      activeCount={snapshot.activeCount}
      weekCount={snapshot.weekCount}
      dueSoon={snapshot.dueSoon}
      highlights={snapshot.highlights}
      onOpen={onOpen}
      onEdit={onEdit}
      isActive={isActive}
      cardRef={setNodeRef}
      dragHandleProps={{ listeners, attributes }}
      style={style}
      isDragging={isDragging}
    />
  );
}



export function HomeDashboard() {
  const { navigateTo, tasks, setSearchOpen, createTask, reorderTasks, updateTask, deleteTask } = useTaskContext();
  const { selectTask } = useTaskContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Task | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');

  const [initialPagesState] = useState(() => loadPagesState());
  const [pages, setPages] = useState<NotePage[]>(initialPagesState.pages);
  const [activePageId, setActivePageId] = useState<string | null>(initialPagesState.activePageId);
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteDraftTitle, setNoteDraftTitle] = useState('');
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const noteDraftContentRef = useRef('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );



  useEffect(() => {
    if (pages.length === 0) return;
    try {
      localStorage.setItem(DASHBOARD_PAGES_STORAGE_KEY, JSON.stringify(pages));
    } catch (error) {
      console.warn('Failed to persist pages:', error);
    }
  }, [pages]);

  useEffect(() => {
    const handleNotesStorageUpdated = () => {
      const nextState = loadPagesState();
      setPages(nextState.pages);
      setActivePageId((prev) => (
        nextState.pages.some((page) => page.id === prev) ? prev : nextState.activePageId
      ));
    };

    window.addEventListener('lifeos:notes-storage-updated', handleNotesStorageUpdated);
    return () => window.removeEventListener('lifeos:notes-storage-updated', handleNotesStorageUpdated);
  }, []);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) || null,
    [pages, activePageId]
  );

  useEffect(() => {
    if (!isNoteModalOpen || !noteEditorRef.current) return;
    noteEditorRef.current.innerHTML = noteDraftContentRef.current || '<p><br></p>';
  }, [isNoteModalOpen, activePageId]);

  const setDraftFromPage = (page: NotePage | null) => {
    if (!page) return;
    setNoteDraftTitle(page.title || 'Untitled');
    noteDraftContentRef.current = page.content || '';
  };

  const commitNoteDraft = () => {
    if (!activePage) return;
    const nextTitle = noteDraftTitle.trim() || 'Untitled';
    const nextContent = noteDraftContentRef.current;
    const currentContent = activePage.content || '';
    if (nextTitle === activePage.title && nextContent === currentContent) return;
    const nowIso = new Date().toISOString();
    setPages((prev) => prev.map((page) => (
      page.id === activePage.id
        ? { ...page, title: nextTitle, content: nextContent, updatedAt: nowIso }
        : page
    )));
  };

  const handleCreatePage = () => {
    const next = createPage();
    setPages((prev) => [next, ...prev]);
    setActivePageId(next.id);
    setDraftFromPage(next);
    setIsNoteModalOpen(true);
  };

  const handleRenamePage = () => {
    const nextTitle = prompt('Rename note', noteDraftTitle || activePage?.title || 'Untitled');
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    setNoteDraftTitle(trimmed);
  };

  const handleDeletePage = () => {
    if (!activePage) return;
    const confirmed = confirm(`Delete page "${activePage.title}"?`);
    if (!confirmed) return;

    setPages((prev) => {
      const next = prev.filter((page) => page.id !== activePage.id);
      if (next.length > 0) {
        setActivePageId(next[0].id);
        if (isNoteModalOpen) {
          setDraftFromPage(next[0]);
        }
        return next;
      }
      const fallback = createPage();
      setActivePageId(fallback.id);
      if (isNoteModalOpen) {
        setDraftFromPage(fallback);
      }
      return [fallback];
    });
  };

  const handleDuplicatePage = () => {
    if (!activePage) return;
    const nowIso = new Date().toISOString();
    const sourceTitle = noteDraftTitle.trim() || activePage.title || 'Untitled';
    const sourceContent = noteDraftContentRef.current || activePage.content || '';
    const copy: NotePage = {
      ...activePage,
      id: buildPageId(),
      title: `${sourceTitle} Copy`,
      content: sourceContent,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setPages((prev) => {
      const next = prev.map((page) => (
        page.id === activePage.id
          ? { ...page, title: sourceTitle, content: sourceContent, updatedAt: nowIso }
          : page
      ));
      return [copy, ...next];
    });
    setActivePageId(copy.id);
    setDraftFromPage(copy);
    setIsNoteModalOpen(true);
  };

  const handlePageTitleChange = (value: string) => {
    setNoteDraftTitle(value);
  };

  const handlePageContentChange = (value: string) => {
    noteDraftContentRef.current = value;
  };

  const sortedPages = useMemo(
    () => pages.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [pages]
  );

  const applyPageCommand = (command: 'bold' | 'italic' | 'insertUnorderedList') => {
    document.execCommand(command);
  };

  const openNoteModal = (pageId: string) => {
    if (isNoteModalOpen) {
      commitNoteDraft();
    }
    const page = pages.find((candidate) => candidate.id === pageId) || null;
    setDraftFromPage(page);
    setActivePageId(pageId);
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    commitNoteDraft();
    setIsNoteModalOpen(false);
  };

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

  const areaSnapshots: AreaSnapshot[] = useMemo(() => {
    return lifeAreas.map(area => {
      const immediateTasks = tasks.filter(t => t.parentId === area.id);

      const statusCounts = COLUMNS.reduce((acc, col) => {
        acc[col.status] = immediateTasks.filter(t => t.status === col.status).length;
        return acc;
      }, {} as Record<TaskStatus, number>);

      const activeCount = immediateTasks.filter(t => t.status !== 'COMPLETED').length;
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);
      const weekCount = immediateTasks.filter(t => {
        if (t.status === 'COMPLETED') return false;
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const scheduled = t.scheduledDate ? new Date(t.scheduledDate) : null;
        return Boolean((due && due <= weekEnd) || (scheduled && scheduled <= weekEnd));
      }).length;

      const dueSoon = immediateTasks.some(isDueWithinThreeDays);

      const highlightCandidates = immediateTasks
        .filter(t => t.status === 'IN_PROGRESS' || isDueWithinThreeDays(t))
        .sort((a, b) => {
          // In-progress first, then by due date
          if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
          if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;
          const ad = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
          const bd = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
          return ad - bd;
        })
        .slice(0, 2);

      return {
        area,
        statusCounts,
        total: immediateTasks.length,
        activeCount,
        weekCount,
        dueSoon,
        highlights: highlightCandidates.map(t => t.title),
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

  const chatContext: AppContext = useMemo(
    () => ({ tasks, navigateTo, selectTask }),
    [tasks, navigateTo, selectTask]
  );

  // Dynamic padding for left (chat) + right (notes) drawers
  const leftPad = isChatDrawerOpen ? 'xl:pl-[330px]' : 'xl:pl-[56px]';
  const rightPad = isNotesDrawerOpen ? 'xl:pr-[330px]' : 'xl:pr-[56px]';

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 px-6 py-4">
        <div className={`flex items-center justify-between max-w-[1600px] mx-auto ${leftPad} ${rightPad}`}>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="font-semibold text-white">LifeOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Home</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold ml-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {/* ─── Chat Drawer (LEFT) ─── */}
        <aside
          className={`hidden xl:block fixed left-0 top-[73px] bottom-0 z-30 transition-[width] duration-200 ${isChatDrawerOpen ? 'w-[330px]' : 'w-[56px]'
            }`}
        >
          <div className="h-full w-full rounded-r-2xl border-r border-t border-b border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-sm">
            <ChatPanel
              appContext={chatContext}
              collapsed={!isChatDrawerOpen}
              onToggle={() => setIsChatDrawerOpen((v) => !v)}
            />
          </div>
        </aside>

        {/* ─── Notes Drawer (RIGHT) ─── */}
        <aside
          className={`hidden xl:block fixed right-0 top-[73px] bottom-0 z-30 transition-[width] duration-200 ${isNotesDrawerOpen ? 'w-[330px]' : 'w-[56px]'
            }`}
        >
          <div className="h-full w-full rounded-l-2xl border-l border-t border-b border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-sm">
            {!isNotesDrawerOpen ? (
              <button
                type="button"
                onClick={() => setIsNotesDrawerOpen(true)}
                className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-slate-100"
                aria-label="Open notes drawer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] uppercase tracking-[0.22em] [writing-mode:vertical-rl] rotate-180">
                  Notes
                </span>
              </button>
            ) : (
              <div className="h-full flex flex-col">
                <div className="px-4 py-3 border-b border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">NOTES</p>
                      <p className="text-[11px] text-slate-400">{sortedPages.length} total</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleCreatePage}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium bg-white text-slate-900"
                      >
                        New
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNotesDrawerOpen(false)}
                        className="h-8 w-8 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                        aria-label="Collapse notes drawer"
                      >
                        <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {sortedPages.map((page) => {
                    const isActive = page.id === activePageId;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => openNoteModal(page.id)}
                        className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${isActive
                          ? 'bg-slate-800 text-white'
                          : 'hover:bg-slate-800/70 text-slate-300'
                          }`}
                      >
                        <p className="text-sm font-medium truncate">{page.title || 'Untitled'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className={`max-w-[1600px] mx-auto p-6 ${leftPad} ${rightPad}`}>
          {/* ─── Two-Panel Layout ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
            {/* ─── LEFT: Focus Areas ─── */}
            <div className="space-y-5">
              <h2 className="text-[15px] font-semibold text-white tracking-tight">Focus Areas</h2>
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={lifeAreas.map(area => area.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      activeCount={activeArea.activeCount}
                      weekCount={activeArea.weekCount}
                      dueSoon={activeArea.dueSoon}
                      onOpen={() => { }}
                      muted
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            {/* ─── RIGHT: Planner & Upcoming ─── */}
            <div className="space-y-5 lg:sticky lg:top-0 lg:self-start">
              <h2 className="text-[15px] font-semibold text-white tracking-tight">Planner &amp; Upcoming</h2>

              {/* Planner */}
              <PlannerCard
                tasks={tasks}
                navigateTo={navigateTo}
                selectTask={selectTask}
                createTask={createTask}
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
                            <div className="text-[13px] text-slate-200 truncate">{task.title}</div>
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

          {isNoteModalOpen && activePage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={closeNoteModal}
              />
              <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={noteDraftTitle}
                    onChange={(e) => handlePageTitleChange(e.target.value)}
                    className="flex-1 bg-transparent text-lg font-semibold text-slate-900 dark:text-white focus:outline-none border-b border-slate-200 dark:border-slate-700 pb-1"
                  />
                  <button
                    type="button"
                    onClick={closeNoteModal}
                    className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Close note"
                  >
                    <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyPageCommand('bold')}
                      className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPageCommand('italic')}
                      className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 text-sm italic font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPageCommand('insertUnorderedList')}
                      className="h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Bullet list"
                    >
                      •
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleRenamePage}
                      className="px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicatePage}
                      className="px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePage}
                      className="px-2 py-1 rounded-md text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div
                  ref={noteEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => handlePageContentChange((e.currentTarget as HTMLDivElement).innerHTML)}
                  className="min-h-[300px] max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
                />
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
