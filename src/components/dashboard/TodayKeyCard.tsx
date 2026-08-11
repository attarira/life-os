'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { CardShell } from './CardShell';

const TODAY_KEY_TAG = 'today-key';
const TODAY_KEY_PARENT_ID = 'today-key';

type TodayKeyTaskRow = {
  id: string;
  title: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  sort_order: number;
  due_date: string | null;
  created_at: string;
};

type TodayKeyTask = {
  id: string;
  title: string;
  status: TodayKeyTaskRow['status'];
  priority: TodayKeyTaskRow['priority'];
  sortOrder: number;
  dueDate: Date | null;
  createdAt: Date;
};

function rowToTask(row: TodayKeyTaskRow): TodayKeyTask {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    sortOrder: row.sort_order,
    dueDate: row.due_date ? new Date(row.due_date) : null,
    createdAt: new Date(row.created_at),
  };
}

export function TodayKeyCard() {
  const [tasks, setTasks] = useState<TodayKeyTask[]>([]);
  const [query, setQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTasks([]);
      setError('Supabase is not configured.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: loadError } = await getSupabase()
      .from('tasks')
      .select('id,title,status,priority,sort_order,due_date,created_at')
      .eq('parent_id', TODAY_KEY_PARENT_ID)
      .contains('tags', [TODAY_KEY_TAG])
      .neq('status', 'COMPLETED')
      .eq('calendar_only', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (loadError) {
      setError('Could not load key tasks.');
      setTasks([]);
    } else {
      setTasks((data as TodayKeyTaskRow[]).map(rowToTask));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadTasks);
  }, [loadTasks]);

  const keyTasks = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return [...tasks]
      .map((task) => {
        const dueToday = Boolean(task.dueDate && task.dueDate <= endOfToday);
        const score = (dueToday ? 2 : 0) + (task.priority === 'HIGH' ? 1 : 0);
        return { task, dueToday, score };
      })
      .sort((a, b) => b.score - a.score || a.task.sortOrder - b.task.sortOrder);
  }, [tasks]);

  const trimmed = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!trimmed) return [];
    return keyTasks
      .map(({ task }) => task)
      .filter((task) => task.title.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [keyTasks, trimmed]);

  const handleCreateTodayTask = async () => {
    const title = newTitle.trim();
    if (!title || !isSupabaseConfigured) return;

    const now = new Date();
    const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const sortOrder = tasks.length ? Math.max(...tasks.map((task) => task.sortOrder)) + 1 : 0;

    const { data, error: createError } = await getSupabase()
      .from('tasks')
      .insert({
        parent_id: TODAY_KEY_PARENT_ID,
        title,
        status: 'NOT_STARTED',
        priority: 'HIGH',
        due_date: todayNoon.toISOString(),
        tags: [TODAY_KEY_TAG],
        calendar_only: false,
        sort_order: sortOrder,
      })
      .select('id,title,status,priority,sort_order,due_date,created_at')
      .single();

    if (createError) {
      setError('Could not add key task.');
      return;
    }

    setTasks((prev) => [...prev, rowToTask(data as TodayKeyTaskRow)]);
    setNewTitle('');
    setIsAdding(false);
    setError(null);
  };

  const handleStartInlineEdit = (task: TodayKeyTask) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
  };

  const handleSaveInlineEdit = async (taskId: string) => {
    const trimmedTitle = editingTitle.trim();
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!trimmedTitle || !currentTask || trimmedTitle === currentTask.title) {
      setEditingId(null);
      return;
    }

    const { data, error: updateError } = await getSupabase()
      .from('tasks')
      .update({ title: trimmedTitle })
      .eq('id', taskId)
      .select('id,title,status,priority,sort_order,due_date,created_at')
      .single();

    if (updateError) {
      setError('Could not update key task.');
      return;
    }

    const updated = rowToTask(data as TodayKeyTaskRow);
    setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    setEditingId(null);
    setError(null);
  };

  const handleCompleteTask = async (taskId: string) => {
    const { error: updateError } = await getSupabase()
      .from('tasks')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      setError('Could not complete key task.');
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setError(null);
  };

  const handleTogglePriority = async (e: React.MouseEvent, task: TodayKeyTask) => {
    e.stopPropagation();
    const nextPriority = task.priority === 'HIGH' ? 'MEDIUM' : 'HIGH';

    const { data, error: updateError } = await getSupabase()
      .from('tasks')
      .update({ priority: nextPriority })
      .eq('id', task.id)
      .select('id,title,status,priority,sort_order,due_date,created_at')
      .single();

    if (updateError) {
      setError('Could not update key task priority.');
      return;
    }

    const updated = rowToTask(data as TodayKeyTaskRow);
    setTasks((prev) => prev.map((prevTask) => (prevTask.id === task.id ? updated : prevTask)));
    setError(null);
  };

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();

    const { error: deleteError } = await getSupabase()
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      setError('Could not delete key task.');
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setError(null);
  };

  return (
    <CardShell
      index="06"
      title="Today · Key"
      right={
        <div className="flex items-center gap-2">
          {!trimmed && <span className="font-mono text-[11px] tabular-nums text-amber-300">★ {keyTasks.length}</span>}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="rounded p-1 text-[var(--op-dim)] transition-colors hover:bg-white/[0.06] hover:text-[var(--op-text)]"
            title="Add Task for Today"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      }
    >
      {isAdding && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--op-accent)]/50 bg-[var(--op-inset)] px-3 py-1.5">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTodayTask();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            placeholder="Add key task for today..."
            className="flex-1 bg-transparent text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleCreateTodayTask}
            disabled={!newTitle.trim() || !isSupabaseConfigured}
            className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--op-accent)] hover:bg-[var(--op-accent)]/10 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-1.5 transition-colors focus-within:border-[var(--op-border-strong)]">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-[var(--op-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder="Search tasks..."
          className="flex-1 bg-transparent text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="flex-shrink-0 text-[var(--op-dim)] hover:text-[var(--op-text)]" aria-label="Clear search">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-[11px] text-rose-300">{error}</p>}

      {isLoading ? (
        <p className="py-3 text-[12px] text-[var(--op-dim)]">Loading key tasks...</p>
      ) : trimmed ? (
        searchResults.length === 0 ? (
          <p className="py-3 text-[12px] text-[var(--op-dim)]">No matching tasks.</p>
        ) : (
          <div className="space-y-0.5">
            {searchResults.map((task) => (
              <div
                key={task.id}
                className="group flex w-full items-start gap-2.5 rounded-md px-1 py-2 text-left hover:bg-white/[0.03]"
              >
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-[var(--op-dim)]">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                <button onClick={() => handleStartInlineEdit(task)} className="min-w-0 flex-1 truncate text-left text-[13px] text-[var(--op-text)]">
                  {task.title}
                </button>
                <button
                  onClick={(e) => handleTogglePriority(e, task)}
                  className={`mt-0.5 flex-shrink-0 text-[10px] transition-colors ${task.priority === 'HIGH' ? 'text-amber-400' : 'text-[var(--op-dim)] hover:text-amber-300'}`}
                  title={task.priority === 'HIGH' ? 'Remove star' : 'Add star'}
                  aria-label={task.priority === 'HIGH' ? `Remove star from ${task.title}` : `Add star to ${task.title}`}
                >
                  ★
                </button>
              </div>
            ))}
          </div>
        )
      ) : keyTasks.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[12px] text-[var(--op-dim)]">No key tasks for today.</p>
          <button
            onClick={() => setIsAdding(true)}
            className="mt-2 font-mono text-[11px] text-[var(--op-accent)] hover:underline"
          >
            + Add a task
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {keyTasks.map(({ task, dueToday }) => {
            const isEditingThis = editingId === task.id;

            return (
              <div key={task.id} className="group flex items-center gap-2.5 rounded-md px-1.5 py-2 transition-colors hover:bg-white/[0.03]">
                <button
                  onClick={() => handleCompleteTask(task.id)}
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-[var(--op-dim)] transition-colors hover:border-[var(--op-accent)] hover:bg-[var(--op-accent)]/10"
                  title="Mark as completed"
                  aria-label={`Complete ${task.title}`}
                />

                <div className="min-w-0 flex-1">
                  {isEditingThis ? (
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveInlineEdit(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveInlineEdit(task.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full border-b border-[var(--op-accent)] bg-transparent text-[13px] text-[var(--op-text)] focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <div onClick={() => handleStartInlineEdit(task)} className="cursor-pointer">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] text-[var(--op-text)] transition-colors group-hover:text-[var(--op-accent)]">{task.title}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {dueToday && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-amber-300">Today</span>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[var(--op-dim)]">
                  <button
                    onClick={(e) => handleTogglePriority(e, task)}
                    className={`rounded p-1.5 text-[12px] transition-colors hover:bg-white/[0.06] ${task.priority === 'HIGH' ? 'text-amber-400 hover:text-amber-300' : 'text-[var(--op-dim)] hover:text-amber-300'}`}
                    title={task.priority === 'HIGH' ? 'Remove star' : 'Add star'}
                    aria-label={task.priority === 'HIGH' ? `Remove star from ${task.title}` : `Add star to ${task.title}`}
                  >
                    ★
                  </button>
                  <button
                    onClick={() => handleStartInlineEdit(task)}
                    className="rounded p-1.5 transition-colors hover:bg-white/[0.06] hover:text-[var(--op-text)]"
                    title="Rename task inline"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDeleteTask(e, task.id)}
                    className="rounded p-1.5 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
                    title="Delete task"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}
