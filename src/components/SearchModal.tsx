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
  }, [searchOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === '/' && !searchOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  if (!searchOpen) return null;

  const handleClose = () => {
    setQuery('');
    setSearchOpen(false);
  };

  const handleSelect = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      navigateTo(task.parentId);
      selectTask(taskId);
      handleClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-[#05080d]/80 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-x-4 top-[12%] z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-[var(--op-border-strong)] bg-[#0a0e15] shadow-2xl md:inset-x-auto md:left-1/2 md:w-full md:max-w-xl md:-translate-x-1/2">
        {/* Search Header Strip */}
        <div className="flex items-center gap-3 border-b border-[var(--op-border)] bg-black/30 px-4 py-3.5">
          <svg className="h-4 w-4 flex-shrink-0 text-[var(--op-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, notes, areas..."
            className="flex-1 bg-transparent text-[14px] font-normal text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[var(--op-dim)] hover:text-[var(--op-text)]"
              title="Clear search"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden rounded border border-[var(--op-border-strong)] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--op-muted)] md:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--op-dim)]">
                Global Task Search
              </p>
              <p className="text-[12px] text-[var(--op-muted)]">
                Type keywords to find tasks across all life areas and subtasks.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-[var(--op-dim)]">No matches found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.slice(0, 15).map((task) => {
                const path = getTaskPath(tasks, task.id);
                const area = path[0]?.title || 'Root';
                const parentPath = path.length > 2 ? path.slice(1, -1).map((p) => p.title).join(' › ') : '';

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleSelect(task.id)}
                    className="group flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-[var(--op-text)] group-hover:text-[var(--op-accent)] transition-colors">
                        {task.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-[var(--op-muted)] truncate">
                        <span className="uppercase text-[var(--op-sub)]">{area}</span>
                        {parentPath && <span>› {parentPath}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
                          task.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-white/[0.04] text-[var(--op-dim)]'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
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
