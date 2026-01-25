'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { getTaskPath } from '@/lib/tasks';

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

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => setSearchOpen(false)}
      />

      <div className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[70vh] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything..."
            className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-lg font-light"
          />
          <kbd className="hidden md:block px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          {query.trim() === '' ? (
            <div className="px-4 text-xs font-medium text-slate-400 uppercase tracking-widest py-2">
              Recent Searches or Hints
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 font-light">No matches found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.slice(0, 10).map(task => {
                const path = getTaskPath(tasks, task.id);
                const area = path[0]?.title || 'Root';

                return (
                  <button
                    key={task.id}
                    onClick={() => handleSelect(task.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {task.title}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-light mt-0.5 truncate">
                          {area} {path.length > 2 ? `› ... › ${path[path.length - 2].title}` : ''}
                        </div>
                      </div>
                      <div className={`text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-bold tracking-tighter`}>
                        {task.status.replace('_', ' ')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
