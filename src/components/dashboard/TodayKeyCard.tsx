'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { CardShell } from './CardShell';

const TODAY_KEY_TAG = 'today-key';
const TODAY_KEY_PARENT_ID = 'today-key';
const LOCAL_STORAGE_KEY = 'lifeos:today-key-tasks:v2';

export type TodayKeyTaskRow = {
  id: string;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  sort_order: number;
  due_date: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type TodayKeyTask = {
  id: string;
  parentId?: string | null;
  title: string;
  description?: string | null;
  status: TodayKeyTaskRow['status'];
  priority: TodayKeyTaskRow['priority'];
  sortOrder: number;
  dueDate: Date | null;
  createdAt: Date;
  completedAt?: Date | null;
};

type SortMode = 'due_date' | 'priority' | 'created_date';

function rowToTask(row: TodayKeyTaskRow): TodayKeyTask {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    title: row.title,
    description: row.description || null,
    status: row.status,
    priority: row.priority,
    sortOrder: row.sort_order ?? 0,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    createdAt: new Date(row.created_at || Date.now()),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

function taskToRow(task: TodayKeyTask): TodayKeyTaskRow {
  return {
    id: task.id,
    parent_id: task.parentId || TODAY_KEY_PARENT_ID,
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority,
    sort_order: task.sortOrder,
    due_date: task.dueDate ? task.dueDate.toISOString() : null,
    created_at: task.createdAt.toISOString(),
    completed_at: task.completedAt ? task.completedAt.toISOString() : null,
  };
}

function formatGroupDateHeader(date: Date | null): string {
  if (!date) return 'No deadline';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Overdue';
  }
  if (diffDays === 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Due tomorrow';
  }

  return `Due ${date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`;
}

function formatTaskDueDateChip(dueDate: Date | null): { label: string; isOverdue: boolean; isToday: boolean } | null {
  if (!dueDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Overdue, ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      isOverdue: true,
      isToday: false,
    };
  }
  if (diffDays === 0) {
    return { label: 'Today', isOverdue: false, isToday: true };
  }
  if (diffDays === 1) {
    return { label: 'Tomorrow', isOverdue: false, isToday: false };
  }
  return {
    label: dueDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    isOverdue: false,
    isToday: false,
  };
}

export function TodayKeyCard() {
  const [tasks, setTasks] = useState<TodayKeyTask[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('due_date');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [newDetails, setNewDetails] = useState('');
  const [showAddDetails, setShowAddDetails] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'title' | 'details' | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDetails, setEditingDetails] = useState('');

  // Portal Context Menu State
  const [menuTask, setMenuTask] = useState<TodayKeyTask | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [addingSubtaskForId, setAddingSubtaskForId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showNoDueDateTasks, setShowNoDueDateTasks] = useState(false);
  const [showDistantDueDateTasks, setShowDistantDueDateTasks] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortButtonRef = useRef<HTMLButtonElement>(null);

  // Close menus on resize or scroll
  useEffect(() => {
    function handleWindowEvents() {
      setMenuTask(null);
      setSortMenuOpen(false);
    }
    window.addEventListener('resize', handleWindowEvents);
    window.addEventListener('scroll', handleWindowEvents, true);
    return () => {
      window.removeEventListener('resize', handleWindowEvents);
      window.removeEventListener('scroll', handleWindowEvents, true);
    };
  }, []);

  // Load Tasks from Supabase or Local Storage
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (isSupabaseConfigured) {
      try {
        const { data, error: loadError } = await getSupabase()
          .from('tasks')
          .select('id,parent_id,title,description,status,priority,sort_order,due_date,created_at,completed_at')
          .or(`parent_id.eq.${TODAY_KEY_PARENT_ID},tags.cs.{${TODAY_KEY_TAG}}`)
          .eq('calendar_only', false)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (loadError) {
          throw loadError;
        }

        if (data) {
          setTasks((data as TodayKeyTaskRow[]).map(rowToTask));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not load key tasks from Supabase.';
        setError(message);
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (raw) {
            setTasks(JSON.parse(raw).map((r: TodayKeyTaskRow) => rowToTask(r)));
          }
        } catch {}
      }
    } else {
      // Local storage mode
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          setTasks(JSON.parse(raw).map((r: TodayKeyTaskRow) => rowToTask(r)));
        } else {
          // Default seed data for immediate demonstration
          const now = new Date();
          const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
          const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7 || 7), 12);
          const oct31 = new Date(now.getFullYear(), 9, 31, 12);

          const sample: TodayKeyTaskRow[] = [
            {
              id: 'task-1',
              parent_id: TODAY_KEY_PARENT_ID,
              title: 'FADV Background Check',
              status: 'NOT_STARTED',
              priority: 'HIGH',
              sort_order: 0,
              due_date: tomorrow.toISOString(),
              created_at: new Date().toISOString(),
            },
            {
              id: 'task-2',
              parent_id: TODAY_KEY_PARENT_ID,
              title: 'PeopleStrong Portal',
              status: 'NOT_STARTED',
              priority: 'MEDIUM',
              sort_order: 1,
              due_date: saturday.toISOString(),
              created_at: new Date().toISOString(),
            },
            {
              id: 'task-3',
              parent_id: TODAY_KEY_PARENT_ID,
              title: 'Google Cloud MLE Cert',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              sort_order: 2,
              due_date: oct31.toISOString(),
              created_at: new Date().toISOString(),
            },
            {
              id: 'task-4',
              parent_id: TODAY_KEY_PARENT_ID,
              title: 'Email PMO',
              description: 'change reporting manager to vishal',
              status: 'NOT_STARTED',
              priority: 'MEDIUM',
              sort_order: 3,
              due_date: null,
              created_at: new Date().toISOString(),
            },
          ];
          setTasks(sample.map(rowToTask));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sample));
        }
      } catch {
        setTasks([]);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  // Persist to local storage if not using supabase
  const persistLocal = useCallback((updatedTasks: TodayKeyTask[]) => {
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify(updatedTasks.map(taskToRow))
        );
      } catch {}
    }
  }, []);

  // Separate parent tasks and subtasks
  const { topLevelTasks, subtaskMap, completedTasks } = useMemo(() => {
    const parentMap = new Map<string, TodayKeyTask[]>();
    const completed: TodayKeyTask[] = [];
    const topLevel: TodayKeyTask[] = [];

    tasks.forEach((t) => {
      if (t.status === 'COMPLETED') {
        completed.push(t);
      } else if (t.parentId && t.parentId !== TODAY_KEY_PARENT_ID && t.parentId !== 'root') {
        const subs = parentMap.get(t.parentId) || [];
        subs.push(t);
        parentMap.set(t.parentId, subs);
      } else {
        topLevel.push(t);
      }
    });

    return { topLevelTasks: topLevel, subtaskMap: parentMap, completedTasks: completed };
  }, [tasks]);

  // Sorting
  const sortedTopLevelTasks = useMemo(() => {
    const list = [...topLevelTasks];

    if (sortMode === 'due_date') {
      return list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.sortOrder - b.sortOrder;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime() || a.sortOrder - b.sortOrder;
      });
    }

    if (sortMode === 'priority') {
      const priorityScore = (p: TodayKeyTask['priority']) =>
        p === 'HIGH' ? 3 : p === 'MEDIUM' ? 2 : 1;
      return list.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority) || a.sortOrder - b.sortOrder);
    }

    if (sortMode === 'created_date') {
      return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return list;
  }, [topLevelTasks, sortMode]);

  const hiddenTaskCutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date;
  }, []);

  const noDueDateTasks = useMemo(
    () => sortedTopLevelTasks.filter((task) => !task.dueDate),
    [sortedTopLevelTasks]
  );

  const distantDueDateTasks = useMemo(
    () => sortedTopLevelTasks.filter((task) => task.dueDate && task.dueDate.getTime() > hiddenTaskCutoff.getTime()),
    [sortedTopLevelTasks, hiddenTaskCutoff]
  );

  const visibleTopLevelTasks = useMemo(
    () => sortedTopLevelTasks.filter((task) => task.dueDate && task.dueDate.getTime() <= hiddenTaskCutoff.getTime()),
    [sortedTopLevelTasks, hiddenTaskCutoff]
  );

  // Grouping for 'due_date' sort mode
  const groupedTasks = useMemo(() => {
    if (sortMode !== 'due_date') {
      return [{ groupName: null, items: visibleTopLevelTasks }];
    }

    const groups: { groupName: string; items: TodayKeyTask[] }[] = [];
    const map = new Map<string, TodayKeyTask[]>();

    visibleTopLevelTasks.forEach((task) => {
      const header = formatGroupDateHeader(task.dueDate);
      const existing = map.get(header) || [];
      existing.push(task);
      map.set(header, existing);
    });

    map.forEach((items, groupName) => {
      groups.push({ groupName, items });
    });

    return groups;
  }, [visibleTopLevelTasks, sortMode]);

  // Filter with query
  const trimmed = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!trimmed) return groupedTasks;

    return groupedTasks
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (t) =>
            t.title.toLowerCase().includes(trimmed) ||
            (t.description && t.description.toLowerCase().includes(trimmed)) ||
            (subtaskMap.get(t.id) || []).some(
              (sub) =>
                sub.title.toLowerCase().includes(trimmed) ||
                (sub.description && sub.description.toLowerCase().includes(trimmed))
            )
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groupedTasks, trimmed, subtaskMap]);

  // --- CRUD Handlers ---

  const handleCreateTask = async () => {
    const title = newTitle.trim();
    if (!title) return;

    const parsedDue = newDueDate ? new Date(`${newDueDate}T12:00:00`) : null;
    const sortOrder = tasks.length ? Math.max(...tasks.map((t) => t.sortOrder)) + 1 : 0;
    const tempId = `task-${Date.now()}`;

    const newTask: TodayKeyTask = {
      id: tempId,
      parentId: TODAY_KEY_PARENT_ID,
      title,
      description: newDetails.trim() || null,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      sortOrder,
      dueDate: parsedDue,
      createdAt: new Date(),
    };

    if (isSupabaseConfigured) {
      const { data, error: createError } = await getSupabase()
        .from('tasks')
        .insert({
          parent_id: TODAY_KEY_PARENT_ID,
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          priority: newTask.priority,
          due_date: newTask.dueDate ? newTask.dueDate.toISOString() : null,
          tags: [TODAY_KEY_TAG],
          calendar_only: false,
          sort_order: sortOrder,
        })
        .select('id,parent_id,title,description,status,priority,sort_order,due_date,created_at,completed_at')
        .single();

      if (!createError && data) {
        setTasks((prev) => [...prev, rowToTask(data as TodayKeyTaskRow)]);
      } else {
        setTasks((prev) => [...prev, newTask]);
      }
    } else {
      const next = [...tasks, newTask];
      setTasks(next);
      persistLocal(next);
    }

    setNewTitle('');
    setNewDueDate('');
    setNewDetails('');
    setShowAddDetails(false);
    setIsAdding(false);
    setError(null);
  };

  const handleToggleComplete = async (task: TodayKeyTask) => {
    const nextStatus: TodayKeyTask['status'] =
      task.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED';
    const completedAt = nextStatus === 'COMPLETED' ? new Date() : null;

    const updated = { ...task, status: nextStatus, completedAt };
    const nextTasks = tasks.map((t) => (t.id === task.id ? updated : t));
    setTasks(nextTasks);
    persistLocal(nextTasks);

    if (isSupabaseConfigured) {
      await getSupabase()
        .from('tasks')
        .update({
          status: nextStatus,
          completed_at: completedAt ? completedAt.toISOString() : null,
        })
        .eq('id', task.id);
    }
  };

  const handleUpdateTask = async (taskId: string, patch: Partial<TodayKeyTask>) => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;

    const updated: TodayKeyTask = { ...current, ...patch };
    const nextTasks = tasks.map((t) => (t.id === taskId ? updated : t));
    setTasks(nextTasks);
    persistLocal(nextTasks);

    if (isSupabaseConfigured) {
      const dbUpdates: Partial<TodayKeyTaskRow> = {};
      if (patch.title !== undefined) dbUpdates.title = patch.title;
      if (patch.description !== undefined) dbUpdates.description = patch.description;
      if (patch.status !== undefined) dbUpdates.status = patch.status;
      if (patch.priority !== undefined) dbUpdates.priority = patch.priority;
      if (patch.dueDate !== undefined)
        dbUpdates.due_date = patch.dueDate ? patch.dueDate.toISOString() : null;
      if (patch.parentId !== undefined) dbUpdates.parent_id = patch.parentId;

      await getSupabase().from('tasks').update(dbUpdates).eq('id', taskId);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const subIds = (subtaskMap.get(taskId) || []).map((s) => s.id);
    const toDeleteIds = [taskId, ...subIds];

    const nextTasks = tasks.filter((t) => !toDeleteIds.includes(t.id));
    setTasks(nextTasks);
    persistLocal(nextTasks);
    setMenuTask(null);

    if (isSupabaseConfigured) {
      await getSupabase().from('tasks').delete().in('id', toDeleteIds);
    }
  };

  const handleAddSubtask = async (parentId: string) => {
    const title = newSubtaskTitle.trim();
    if (!title) return;

    const parent = tasks.find((t) => t.id === parentId);
    const sortOrder = (subtaskMap.get(parentId) || []).length;
    const tempId = `sub-${Date.now()}`;

    const newSub: TodayKeyTask = {
      id: tempId,
      parentId,
      title,
      status: 'NOT_STARTED',
      priority: parent ? parent.priority : 'MEDIUM',
      sortOrder,
      dueDate: parent?.dueDate || null,
      createdAt: new Date(),
    };

    if (isSupabaseConfigured) {
      const { data, error: createError } = await getSupabase()
        .from('tasks')
        .insert({
          parent_id: parentId,
          title,
          status: 'NOT_STARTED',
          priority: newSub.priority,
          due_date: newSub.dueDate ? newSub.dueDate.toISOString() : null,
          tags: [TODAY_KEY_TAG],
          calendar_only: false,
          sort_order: sortOrder,
        })
        .select('id,parent_id,title,description,status,priority,sort_order,due_date,created_at,completed_at')
        .single();

      if (!createError && data) {
        setTasks((prev) => [...prev, rowToTask(data as TodayKeyTaskRow)]);
      } else {
        setTasks((prev) => [...prev, newSub]);
      }
    } else {
      const next = [...tasks, newSub];
      setTasks(next);
      persistLocal(next);
    }

    setNewSubtaskTitle('');
    setAddingSubtaskForId(null);
    setExpandedSubtasks((prev) => ({ ...prev, [parentId]: true }));
  };

  const handleStartTask = (task: TodayKeyTask) => {
    const nextStatus = task.status === 'IN_PROGRESS' ? 'NOT_STARTED' : 'IN_PROGRESS';
    void handleUpdateTask(task.id, { status: nextStatus });
    setMenuTask(null);
  };

  const handleToggleStar = (task: TodayKeyTask) => {
    const nextPriority = task.priority === 'HIGH' ? 'MEDIUM' : 'HIGH';
    void handleUpdateTask(task.id, { priority: nextPriority });
  };

  const openSortMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSortMenuPos({
      top: rect.bottom + 4,
      left: rect.right,
    });
    setSortMenuOpen(true);
  };

  const openTaskMenu = (e: React.MouseEvent<HTMLButtonElement>, task: TodayKeyTask) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 230;

    // Flip up if close to bottom of screen
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 4;
    }

    setMenuPos({
      top: Math.max(10, top),
      left: rect.right,
    });
    setMenuTask(task);
  };

  return (
    <CardShell
      index="06"
      title="Tasks"
      right={
        <div className="relative flex items-center gap-1">
          {/* Sort Menu Button */}
          <button
            ref={sortButtonRef}
            onClick={openSortMenu}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-mono text-[var(--op-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--op-text)]"
            title="Sort tasks"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 10h12M9 16h6" />
            </svg>
            <span className="hidden sm:inline">
              {sortMode === 'due_date'
                ? 'Date'
                : sortMode === 'priority'
                ? 'Starred'
                : 'Newest'}
            </span>
          </button>
        </div>
      }
    >
      {/* ─── Google Tasks "Add a task" button/inline row ─── */}
      <div className="mb-2">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-400 transition-transform group-hover:scale-105">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-[13.5px] font-medium text-sky-400 group-hover:text-sky-300">
              Add a task
            </span>
          </button>
        ) : (
          <div className="rounded-xl border border-sky-500/40 bg-[var(--op-inset)] p-3 shadow-lg transition-all">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleCreateTask();
                }
                if (e.key === 'Escape') {
                  setIsAdding(false);
                }
              }}
              placeholder="Title"
              className="w-full bg-transparent text-[13.5px] font-medium text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
              autoFocus
            />

            {showAddDetails ? (
              <textarea
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                placeholder="Details"
                rows={2}
                className="mt-2 w-full resize-none bg-transparent text-[12px] text-[var(--op-sub)] placeholder:text-[var(--op-dim)] focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddDetails(true)}
                className="mt-1.5 block text-[11.5px] text-[var(--op-muted)] hover:text-sky-400"
              >
                + Add details
              </button>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--op-border)] pt-2">
              {/* Google Tasks Date Picker Button */}
              <label className="flex items-center gap-1.5 rounded-lg border border-[var(--op-border)] bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-[var(--op-sub)] hover:border-sky-400 hover:text-sky-300 transition-colors cursor-pointer">
                <svg className="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>
                  {newDueDate
                    ? new Date(`${newDueDate}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Set deadline'}
                </span>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.target as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="sr-only"
                />
                {newDueDate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNewDueDate('');
                    }}
                    className="ml-1 text-[var(--op-dim)] hover:text-rose-400"
                    title="Clear date"
                  >
                    ✕
                  </button>
                )}
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewTitle('');
                    setNewDetails('');
                    setNewDueDate('');
                    setShowAddDetails(false);
                  }}
                  className="rounded px-2.5 py-1 text-[11.5px] text-[var(--op-muted)] hover:text-[var(--op-text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={!newTitle.trim()}
                  className="rounded bg-sky-500 px-3 py-1 text-[11.5px] font-medium text-slate-950 transition-opacity hover:bg-sky-400 disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Search Bar (minimal & collapsible feel) ─── */}
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] px-2.5 py-1 transition-colors focus-within:border-[var(--op-border-strong)]">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-[var(--op-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="flex-1 bg-transparent text-[12.5px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-[var(--op-dim)] hover:text-[var(--op-text)]">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-[11px] text-rose-400">{error}</p>}

      {/* ─── Task List View ─── */}
      {isLoading ? (
        <p className="py-4 text-center text-[12px] text-[var(--op-dim)]">Loading tasks...</p>
      ) : filteredGroups.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[12.5px] text-[var(--op-dim)]">No tasks match your filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group, groupIdx) => (
            <div key={group.groupName || groupIdx} className="space-y-1">
              {/* Group Header (e.g. "Due tomorrow", "No deadline") */}
              {group.groupName && (
                <div className="px-2 pt-1 font-sans text-[11px] font-semibold tracking-wide text-[var(--op-muted)]">
                  {group.groupName}
                </div>
              )}

              {/* Task Items */}
              <div className="space-y-0.5">
                {group.items.map((task) => {
                  const subtasks = subtaskMap.get(task.id) || [];
                  const isSubtasksExpanded = Boolean(expandedSubtasks[task.id]);
                  const completedSubtasksCount = subtasks.filter((s) => s.status === 'COMPLETED').length;
                  const isEditingThisTitle = editingId === task.id && editingField === 'title';
                  const isEditingThisDetails = editingId === task.id && editingField === 'details';
                  const dueInfo = formatTaskDueDateChip(task.dueDate);

                  return (
                    <div key={task.id} className="group relative rounded-lg transition-colors hover:bg-white/[0.03]">
                      {/* Main Task Row */}
                      <div className="flex items-start gap-2.5 px-2 py-2">
                        {/* Circular Google Tasks Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(task)}
                          className="mt-0.5 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--op-dim)] transition-all hover:border-sky-400 hover:bg-sky-400/10 focus:outline-none"
                          title="Mark completed"
                          aria-label={`Mark ${task.title} as completed`}
                        >
                          {task.status === 'COMPLETED' && (
                            <svg className="h-3 w-3 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Title & Details Column */}
                        <div className="min-w-0 flex-1">
                          {isEditingThisTitle ? (
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => {
                                if (editingTitle.trim() && editingTitle !== task.title) {
                                  void handleUpdateTask(task.id, { title: editingTitle.trim() });
                                }
                                setEditingId(null);
                                setEditingField(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (editingTitle.trim() && editingTitle !== task.title) {
                                    void handleUpdateTask(task.id, { title: editingTitle.trim() });
                                  }
                                  setEditingId(null);
                                  setEditingField(null);
                                }
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                  setEditingField(null);
                                }
                              }}
                              className="w-full border-b border-sky-400 bg-transparent text-[13.5px] font-medium text-[var(--op-text)] focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                onDoubleClick={() => {
                                  setEditingId(task.id);
                                  setEditingField('title');
                                  setEditingTitle(task.title);
                                }}
                                className={`text-[13.5px] font-normal leading-snug tracking-normal transition-colors ${
                                  task.status === 'COMPLETED'
                                    ? 'text-[var(--op-dim)] line-through'
                                    : 'text-[var(--op-text)]'
                                }`}
                              >
                                {task.title}
                              </span>

                              {/* Start / In Progress Status Indicator */}
                              {task.status === 'IN_PROGRESS' && (
                                <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase tracking-wider text-sky-400">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                                  Running
                                </span>
                              )}
                            </div>
                          )}

                          {/* Task Description / Details */}
                          {isEditingThisDetails ? (
                            <textarea
                              value={editingDetails}
                              onChange={(e) => setEditingDetails(e.target.value)}
                              onBlur={() => {
                                void handleUpdateTask(task.id, { description: editingDetails.trim() || null });
                                setEditingId(null);
                                setEditingField(null);
                              }}
                              rows={2}
                              className="mt-1 w-full rounded border border-[var(--op-border-strong)] bg-[var(--op-inset)] p-1.5 text-[12px] text-[var(--op-sub)] focus:outline-none"
                              autoFocus
                            />
                          ) : task.description ? (
                            <p
                              onDoubleClick={() => {
                                setEditingId(task.id);
                                setEditingField('details');
                                setEditingDetails(task.description || '');
                              }}
                              className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--op-muted)]"
                            >
                              {task.description}
                            </p>
                          ) : null}

                          {/* Interactive Date Picker Chip / Button */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {dueInfo ? (
                              <label
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                  dueInfo.isOverdue
                                    ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                                    : dueInfo.isToday
                                    ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                                    : 'bg-white/[0.06] text-[var(--op-sub)] hover:bg-white/[0.1] hover:text-[var(--op-text)]'
                                }`}
                                title="Click to change deadline"
                              >
                                <svg className="h-3 w-3 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                <span>{dueInfo.label}</span>
                                <input
                                  type="date"
                                  value={task.dueDate ? task.dueDate.toISOString().split('T')[0] : ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const newDate = val ? new Date(`${val}T12:00:00`) : null;
                                    void handleUpdateTask(task.id, { dueDate: newDate });
                                  }}
                                  onClick={(e) => {
                                    try {
                                      (e.target as HTMLInputElement).showPicker?.();
                                    } catch {}
                                  }}
                                  className="sr-only"
                                />
                              </label>
                            ) : (
                              <label
                                className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--op-dim)] hover:text-sky-400 hover:bg-white/[0.04] cursor-pointer"
                                title="Set deadline"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                <span>+ Date</span>
                                <input
                                  type="date"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const newDate = val ? new Date(`${val}T12:00:00`) : null;
                                    void handleUpdateTask(task.id, { dueDate: newDate });
                                  }}
                                  onClick={(e) => {
                                    try {
                                      (e.target as HTMLInputElement).showPicker?.();
                                    } catch {}
                                  }}
                                  className="sr-only"
                                />
                              </label>
                            )}

                            {/* Subtasks Count / Quick Expand */}
                            {subtasks.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSubtasks((prev) => ({
                                    ...prev,
                                    [task.id]: !prev[task.id],
                                  }))
                                }
                                className="flex items-center gap-1 text-[11px] font-mono text-[var(--op-dim)] hover:text-sky-400"
                              >
                                <svg
                                  className={`h-3 w-3 transition-transform ${isSubtasksExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                <span>
                                  {completedSubtasksCount}/{subtasks.length} subtasks
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Right Hover Actions: Star & Context Menu (⋮) */}
                        <div className="flex items-center gap-1">
                          {/* Star Priority Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStar(task)}
                            className={`rounded p-1 text-[12px] transition-colors hover:bg-white/[0.06] ${
                              task.priority === 'HIGH'
                                ? 'text-amber-400'
                                : 'text-[var(--op-dim)] opacity-0 group-hover:opacity-100 hover:text-amber-300'
                            }`}
                            title={task.priority === 'HIGH' ? 'Remove star' : 'Star task'}
                          >
                            ★
                          </button>

                          {/* Context Menu Button (⋮) */}
                          <button
                            type="button"
                            onClick={(e) => openTaskMenu(e, task)}
                            className="rounded p-1 text-[var(--op-dim)] opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-[var(--op-text)] group-hover:opacity-100"
                            title="More actions"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Nested Subtasks */}
                      {isSubtasksExpanded && (
                        <div className="ml-7 space-y-1 border-l border-[var(--op-border)] pl-3 pb-2 pt-0.5">
                          {subtasks.map((sub) => (
                            <div
                              key={sub.id}
                              className="group/sub flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-white/[0.03]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleComplete(sub)}
                                  className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-[var(--op-dim)] hover:border-sky-400 hover:bg-sky-400/10"
                                >
                                  {sub.status === 'COMPLETED' && (
                                    <svg className="h-2.5 w-2.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                                <span
                                  className={`truncate text-[12.5px] ${
                                    sub.status === 'COMPLETED'
                                      ? 'text-[var(--op-dim)] line-through'
                                      : 'text-[var(--op-text)]'
                                  }`}
                                >
                                  {sub.title}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(sub.id)}
                                className="rounded p-0.5 text-[var(--op-dim)] opacity-0 hover:text-rose-400 group-hover/sub:opacity-100"
                                title="Delete subtask"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}

                          {/* Add Subtask Input Inline */}
                          {addingSubtaskForId === task.id ? (
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleAddSubtask(task.id);
                                  }
                                  if (e.key === 'Escape') {
                                    setAddingSubtaskForId(null);
                                  }
                                }}
                                placeholder="Subtask title"
                                className="flex-1 border-b border-sky-400 bg-transparent text-[12px] text-[var(--op-text)] focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSubtask(task.id)}
                                className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                              >
                                Add
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAddingSubtaskForId(task.id)}
                              className="mt-1 text-[11px] text-[var(--op-muted)] hover:text-sky-400"
                            >
                              + Add subtask
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── No due date collapsible section ─── */}
      {noDueDateTasks.length > 0 && (
        <div className="mt-4 border-t border-[var(--op-border)] pt-2">
          <button
            type="button"
            onClick={() => setShowNoDueDateTasks(!showNoDueDateTasks)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-[var(--op-muted)] transition-colors hover:bg-white/[0.03] hover:text-[var(--op-text)]"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`h-3 w-3 text-[var(--op-dim)] transition-transform ${showNoDueDateTasks ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>No due date ({noDueDateTasks.length})</span>
            </div>
          </button>

          {showNoDueDateTasks && (
            <div className="mt-1 space-y-0.5 pl-2">
              {noDueDateTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task)}
                      className="flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--op-dim)] transition-all hover:border-sky-400 hover:bg-sky-400/10"
                      title="Mark completed"
                    >
                      {task.status === 'COMPLETED' && (
                        <svg className="h-3 w-3 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className="truncate text-[13px] text-[var(--op-text)]">
                      {task.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="rounded p-1 text-[var(--op-dim)] opacity-0 hover:text-rose-400 group-hover:opacity-100"
                    title="Delete"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {distantDueDateTasks.length > 0 && (
        <div className="mt-2 border-t border-[var(--op-border)] pt-2">
          <button
            type="button"
            onClick={() => setShowDistantDueDateTasks(!showDistantDueDateTasks)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-[var(--op-muted)] transition-colors hover:bg-white/[0.03] hover:text-[var(--op-text)]"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`h-3 w-3 text-[var(--op-dim)] transition-transform ${showDistantDueDateTasks ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Over 3 months ({distantDueDateTasks.length})</span>
            </div>
          </button>

          {showDistantDueDateTasks && (
            <div className="mt-1 space-y-0.5 pl-2">
              {distantDueDateTasks.map((task) => {
                const dueInfo = task.dueDate
                  ? (formatTaskDueDateChip(task.dueDate) ?? { label: 'No due date' })
                  : { label: 'No due date' };

                return (
                  <div
                    key={task.id}
                    className="group flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task)}
                        className="flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--op-dim)] transition-all hover:border-sky-400 hover:bg-sky-400/10"
                        title="Mark completed"
                      >
                        {task.status === 'COMPLETED' && (
                          <svg className="h-3 w-3 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0">
                        <span className="block truncate text-[13px] text-[var(--op-text)]">
                          {task.title}
                        </span>
                        <span className="block text-[10px] text-[var(--op-dim)]">
                          {dueInfo.label}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="rounded p-1 text-[var(--op-dim)] opacity-0 hover:text-rose-400 group-hover:opacity-100"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Google Tasks "Completed (N)" Collapsible Section ─── */}
      {completedTasks.length > 0 && (
        <div className="mt-4 border-t border-[var(--op-border)] pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-[var(--op-muted)] transition-colors hover:bg-white/[0.03] hover:text-[var(--op-text)]"
          >
            <div className="flex items-center gap-2">
              <svg
                className={`h-3 w-3 text-[var(--op-dim)] transition-transform ${showCompleted ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>Completed ({completedTasks.length})</span>
            </div>
          </button>

          {showCompleted && (
            <div className="mt-1 space-y-0.5 pl-2">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center justify-between gap-2 rounded px-2 py-1.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(task)}
                      className="flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
                      title="Uncomplete task"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <span className="truncate text-[13px] text-[var(--op-dim)] line-through">
                      {task.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="rounded p-1 text-[var(--op-dim)] opacity-0 hover:text-rose-400 group-hover:opacity-100"
                    title="Delete"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Portal: Task Context Menu (Never Obscured or Clipped) ─── */}
      {typeof document !== 'undefined' &&
        menuTask &&
        menuPos &&
        ReactDOM.createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                setMenuTask(null);
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                transform: 'translateX(-100%)',
              }}
              className="op z-[9999] min-w-[180px] rounded-lg border border-[var(--op-border-strong)] bg-[#0a0e15] py-1 shadow-2xl backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleStartTask(menuTask)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--op-sub)] hover:bg-white/[0.06] hover:text-[var(--op-text)]"
              >
                <svg className="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                <span>{menuTask.status === 'IN_PROGRESS' ? 'Pause task' : 'Start task'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingId(menuTask.id);
                  setEditingField('details');
                  setEditingDetails(menuTask.description || '');
                  setMenuTask(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--op-sub)] hover:bg-white/[0.06] hover:text-[var(--op-text)]"
              >
                <svg className="h-3.5 w-3.5 text-[var(--op-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
                <span>{menuTask.description ? 'Edit details' : 'Add details'}</span>
              </button>

              {/* Set / Change Deadline Date Picker in Menu */}
              <label className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--op-sub)] hover:bg-white/[0.06] hover:text-[var(--op-text)] cursor-pointer">
                <svg className="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>{menuTask.dueDate ? 'Change deadline' : 'Set deadline'}</span>
                <input
                  type="date"
                  value={menuTask.dueDate ? menuTask.dueDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newDate = val ? new Date(`${val}T12:00:00`) : null;
                    void handleUpdateTask(menuTask.id, { dueDate: newDate });
                    setMenuTask(null);
                  }}
                  onClick={(e) => {
                    try {
                      (e.target as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="sr-only"
                />
              </label>

              {menuTask.dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    void handleUpdateTask(menuTask.id, { dueDate: null });
                    setMenuTask(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--op-sub)] hover:bg-white/[0.06] hover:text-[var(--op-text)]"
                >
                  <svg className="h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Clear deadline</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setAddingSubtaskForId(menuTask.id);
                  setExpandedSubtasks((prev) => ({ ...prev, [menuTask.id]: true }));
                  setMenuTask(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--op-sub)] hover:bg-white/[0.06] hover:text-[var(--op-text)]"
              >
                <svg className="h-3.5 w-3.5 text-[var(--op-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add subtask</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingId(menuTask.id);
                  setEditingField('title');
                  setEditingTitle(menuTask.title);
                  setMenuTask(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[var(--op-sub)] hover:bg-white/[0.06] hover:text-[var(--op-text)]"
              >
                <svg className="h-3.5 w-3.5 text-[var(--op-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                <span>Rename</span>
              </button>

              <div className="my-1 border-t border-[var(--op-border)]" />

              <button
                type="button"
                onClick={() => handleDeleteTask(menuTask.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span>Delete</span>
              </button>
            </div>
          </>,
          document.body
        )}

      {/* ─── Portal: Sort Menu (Never Obscured or Clipped) ─── */}
      {typeof document !== 'undefined' &&
        sortMenuOpen &&
        sortMenuPos &&
        ReactDOM.createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.stopPropagation();
                setSortMenuOpen(false);
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: sortMenuPos.top,
                left: sortMenuPos.left,
                transform: 'translateX(-100%)',
              }}
              className="op z-[9999] min-w-[160px] rounded-lg border border-[var(--op-border-strong)] bg-[#0a0e15] p-1 shadow-2xl backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--op-dim)]">
                Sort by
              </div>
              <button
                type="button"
                onClick={() => {
                  setSortMode('due_date');
                  setSortMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                  sortMode === 'due_date'
                    ? 'bg-sky-500/15 font-medium text-sky-300'
                    : 'text-[var(--op-sub)] hover:bg-white/[0.05] hover:text-[var(--op-text)]'
                }`}
              >
                <span>Due date</span>
                {sortMode === 'due_date' && <span className="text-sky-400">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortMode('priority');
                  setSortMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                  sortMode === 'priority'
                    ? 'bg-sky-500/15 font-medium text-sky-300'
                    : 'text-[var(--op-sub)] hover:bg-white/[0.05] hover:text-[var(--op-text)]'
                }`}
              >
                <span>Starred / Priority</span>
                {sortMode === 'priority' && <span className="text-sky-400">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortMode('created_date');
                  setSortMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                  sortMode === 'created_date'
                    ? 'bg-sky-500/15 font-medium text-sky-300'
                    : 'text-[var(--op-sub)] hover:bg-white/[0.05] hover:text-[var(--op-text)]'
                }`}
              >
                <span>Creation date</span>
                {sortMode === 'created_date' && <span className="text-sky-400">✓</span>}
              </button>
            </div>
          </>,
          document.body
        )}
    </CardShell>
  );
}
