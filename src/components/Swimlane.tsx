'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTaskContext } from '@/lib/task-context';
import { Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface Theme {
  name: string;
  bg: string;
  border: string;
  accent: string;
  text: string;
}

interface SwimlaneProps {
  groupTask: Task;
  columns: { status: TaskStatus; label: string; color: string }[];
  tasksByStatus: Record<TaskStatus, Task[]>;
  theme: Theme;
}

export function Swimlane({ groupTask, columns, tasksByStatus, theme }: SwimlaneProps) {
  const { createTask, navigateTo, selectTask, deleteTask } = useTaskContext();
  const [isAdding, setIsAdding] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const handleAddTask = async (status: TaskStatus) => {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setIsAdding(null);
      return;
    }

    await createTask({
      parentId: groupTask.id,
      title: trimmed,
      status,
      priority: 'MEDIUM',
    });

    setNewTitle('');
    setIsAdding(null);
  };

  const handleHeaderClick = () => {
    navigateTo(groupTask.id);
  };

  return (
    <div className={`flex flex-col mb-6 bg-white dark:bg-slate-800 rounded-xl border ${theme.border} overflow-hidden shadow-sm`}>
      {/* Swimlane Header */}
      <div className={`flex items-center justify-between p-3 ${theme.bg} border-b ${theme.border}`}>
        <div
          className={`flex items-center gap-3 cursor-pointer ${theme.text} hover:opacity-80 transition-opacity`}
          onClick={handleHeaderClick}
        >
          <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
            <svg className={`w-5 h-5 ${theme.text} opacity-70`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-lg">{groupTask.title}</h3>
            {groupTask.description && (
              <p className="text-sm opacity-80 line-clamp-1">{groupTask.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => selectTask(groupTask.id)}
            className={`p-2 ${theme.text} hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors`}
            title="Edit Section Details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Swimlane Columns */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x ${theme.border.replace('border-', 'divide-')}`}>
        {columns.map(col => {
          const tasks = tasksByStatus[col.status];
          const droppableId = `container:${groupTask.id}:${col.status}`;

          return (
            <SwimlaneCell
              key={col.status}
              id={droppableId}
              status={col.status}
              tasks={tasks}
              isAdding={isAdding === col.status}
              onStartAdd={() => setIsAdding(col.status)}
              onCancelAdd={() => setIsAdding(null)}
              onConfirmAdd={() => handleAddTask(col.status)}
              newTitle={newTitle}
              setNewTitle={setNewTitle}
              theme={theme}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SwimlaneCellProps {
  id: string;
  status: TaskStatus;
  tasks: Task[];
  isAdding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
  newTitle: string;
  setNewTitle: (val: string) => void;
  theme: Theme;
}

function SwimlaneCell({ id, status, tasks, isAdding, onStartAdd, onCancelAdd, onConfirmAdd, newTitle, setNewTitle, theme }: SwimlaneCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        p-2 min-h-[150px] transition-colors
        ${isOver ? theme.bg : ''}
      `}
    >
      <div className="space-y-2">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} accentColor={theme.accent} />
          ))}
        </SortableContext>

        {isAdding ? (
          <div className={`bg-white dark:bg-slate-800 rounded-lg border ${theme.accent} p-3 shadow-sm`}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmAdd();
                if (e.key === 'Escape') {
                  setNewTitle('');
                  onCancelAdd();
                }
              }}
              onBlur={onConfirmAdd}
              placeholder="Task title..."
              autoFocus
              className="w-full text-sm bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
        ) : (
          <button
            onClick={onStartAdd}
            className="w-full py-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        )}
      </div>
    </div>
  );
}
