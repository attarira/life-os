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
    });

    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-xl min-h-[200px] h-full
        ${isOver ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-900' : ''}
      `}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h2 className="font-semibold text-slate-700 dark:text-slate-300">{label}</h2>
          <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          title="Add task"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {/* Add task inline form */}
        {isAdding && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-blue-400 p-3 shadow-sm">
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
              placeholder="Task title..."
              autoFocus
              className="w-full text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}
