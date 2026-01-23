'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { Task } from '@/lib/types';

export function TaskPanel() {
  const { tasks, selectedTaskId, selectTask, updateTask, deleteTask, createTask, navigateTo } = useTaskContext();
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const task = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    }
  }, [task]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedTaskId) {
        selectTask(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, selectTask]);

  if (!task) return null;

  const handleDescriptionSave = async () => {
    if (description !== (task.description || '')) {
      await updateTask(task.id, { description: description || undefined });
    }
  };

  const handleDueDateSave = async () => {
    const newDate = dueDate ? new Date(dueDate) : undefined;
    if (newDate?.toISOString() !== task.dueDate?.toISOString()) {
      await updateTask(task.id, { dueDate: newDate });
    }
  };

  const handleAddSubtask = async () => {
    await createTask({
      parentId: task.id,
      title: 'New Subtask',
      status: 'NOT_STARTED',
    });
    navigateTo(task.id);
    selectTask(null);
  };

  const handleDelete = async () => {
    const subtreeCount = tasks.filter(t => t.parentId === task.id).length;
    const message = subtreeCount > 0
      ? `Delete "${task.title}" and all its subtasks?`
      : `Delete "${task.title}"?`;

    if (confirm(message)) {
      await deleteTask(task.id);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => selectTask(null)}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
            {task.title}
          </h2>
          <button
            onClick={() => selectTask(null)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <select
              value={task.status}
              onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionSave}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
              placeholder="Add a description..."
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={handleDueDateSave}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleAddSubtask}
              className="w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              ➕ Add Subtask & View
            </button>
            <button
              onClick={() => {
                navigateTo(task.id);
                selectTask(null);
              }}
              className="w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              📂 View Subtasks
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            🗑️ Delete Task
          </button>
        </div>
      </div>
    </>
  );
}
