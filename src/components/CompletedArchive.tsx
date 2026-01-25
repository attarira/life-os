'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { getTaskPath, formatBreadcrumb, getCompletedAgoText } from '@/lib/tasks';

export function CompletedArchive() {
  const { tasks, archiveOpen, setArchiveOpen, navigateTo, getArchivedTasks } = useTaskContext();
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const archivedTasks = getArchivedTasks();

  const filteredTasks = searchQuery.trim()
    ? archivedTasks.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : archivedTasks;

  useEffect(() => {
    if (archiveOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [archiveOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && archiveOpen) {
        setArchiveOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [archiveOpen, setArchiveOpen]);

  if (!archiveOpen) return null;

  const handleNavigate = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      navigateTo(task.parentId);
      setArchiveOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setArchiveOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg md:max-h-[80vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Completed Archive
          </h2>
          <button
            onClick={() => setArchiveOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived tasks..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTasks.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              {searchQuery ? 'No matching archived tasks' : 'No archived tasks (older than 7 days)'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => {
                const path = getTaskPath(tasks, task.id);
                const breadcrumb = formatBreadcrumb(path.slice(0, -1), 40);

                return (
                  <button
                    key={task.id}
                    onClick={() => handleNavigate(task.id)}
                    className="w-full text-left p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="text-xs text-slate-400 mb-1">{breadcrumb}</div>
                    <div className="font-medium text-slate-900 dark:text-white">{task.title}</div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {getCompletedAgoText(task)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500">
          {archivedTasks.length} task{archivedTasks.length !== 1 ? 's' : ''} completed more than 7 days ago
        </div>
      </div>
    </>
  );
}
