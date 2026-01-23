'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { getTaskPath, formatBreadcrumb } from '@/lib/tasks';

export function SearchModal() {
  const { tasks, searchOpen, setSearchOpen, searchTasks, navigateTo, selectTask } = useTaskContext();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const results = searchTasks(query);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!searchOpen) {
      setQuery('');
    }
  }, [searchOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  if (!searchOpen) return null;

  const handleSelect = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      navigateTo(task.parentId);
      selectTask(taskId);
      setSearchOpen(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOT_STARTED': return 'bg-slate-200 text-slate-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      case 'ON_HOLD': return 'bg-amber-100 text-amber-700';
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-200 text-slate-700';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setSearchOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-20 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl z-50 flex flex-col max-h-[80vh]">
        {/* Search input */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            <kbd className="hidden md:inline-block px-2 py-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 rounded">
              Esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              Type to search tasks...
            </p>
          ) : results.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              No tasks found
            </p>
          ) : (
            <div className="space-y-1">
              {results.slice(0, 20).map(task => {
                const path = getTaskPath(tasks, task.id);
                const breadcrumb = formatBreadcrumb(path.slice(0, -1), 50);

                return (
                  <button
                    key={task.id}
                    onClick={() => handleSelect(task.id)}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400">{breadcrumb}</span>
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 truncate mt-1">
                        {task.description}
                      </div>
                    )}
                  </button>
                );
              })}
              {results.length > 20 && (
                <p className="text-center text-sm text-slate-500 py-2">
                  ...and {results.length - 20} more results
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
