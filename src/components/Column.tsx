'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTaskContext } from '@/lib/task-context';
import { Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
}

export function Column({ status, label, color, tasks }: ColumnProps) {
  const { createTask, currentParentId } = useTaskContext();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const handleAddTask = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }

    await createTask({
      parentId: currentParentId,
      title: trimmed,
      status,
      priority: 'MEDIUM',
    });

    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-[200px] flex-col rounded-xl border bg-[var(--op-panel)] transition-colors ${
        isOver ? 'border-[var(--op-accent)]/50' : 'border-[var(--op-border)]'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-[var(--op-border)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${color}`} />
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-muted)]">{label}</h2>
          <span className="font-mono text-[10px] tabular-nums text-[var(--op-dim)]">{tasks.length}</span>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="rounded-md p-1 text-[var(--op-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--op-text)]"
          title="Add task"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {/* Add task inline form */}
        {isAdding && (
          <div className="rounded-lg border border-[var(--op-accent)]/40 bg-[var(--op-inset)] p-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') {
                  setNewTitle('');
                  setIsAdding(false);
                }
              }}
              onBlur={handleAddTask}
              placeholder="Task title…"
              autoFocus
              className="w-full bg-transparent text-[13px] text-[var(--op-text)] outline-none placeholder:text-[var(--op-dim)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
