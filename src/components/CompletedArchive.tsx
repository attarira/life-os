'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { getTaskPath, formatBreadcrumb, getCompletedAgoText } from '@/lib/tasks';

export function ArchiveInlinePanel({ onNavigate }: { onNavigate?: () => void }) {
  const { tasks, navigateTo, getArchivedTasks } = useTaskContext();
  const [searchQuery, setSearchQuery] = useState('');
  const archivedTasks = getArchivedTasks();

  const filteredTasks = searchQuery.trim()
    ? archivedTasks.filter(
        (task) =>
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : archivedTasks;

  const handleNavigate = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    navigateTo(task.parentId);
    onNavigate?.();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)]">
      <div className="border-b border-[var(--op-border)] p-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search archived tasks..."
          className="w-full rounded-md border border-[var(--op-border)] bg-black/40 px-2.5 py-1.5 text-[12px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-accent)] focus:outline-none"
        />
      </div>

      <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
        {filteredTasks.length === 0 ? (
          <p className="py-6 text-center font-mono text-[10px] text-[var(--op-dim)]">
            {searchQuery ? 'No matching archived tasks' : 'No archived tasks (older than 7 days)'}
          </p>
        ) : (
          filteredTasks.map((task) => {
            const path = getTaskPath(tasks, task.id);
            const breadcrumb = formatBreadcrumb(path.slice(0, -1), 32, false);

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => handleNavigate(task.id)}
                className="group flex w-full flex-col rounded-md p-2 text-left transition-colors hover:bg-white/[0.03]"
              >
                <div className="font-mono text-[9px] uppercase text-[var(--op-dim)]">{breadcrumb}</div>
                <div className="text-[12.5px] font-medium text-[var(--op-text)] group-hover:text-[var(--op-accent)] transition-colors">
                  {task.title}
                </div>
                <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{getCompletedAgoText(task)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-[var(--op-border)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--op-dim)]">
        {archivedTasks.length} task{archivedTasks.length !== 1 ? 's' : ''} completed &gt;7d ago
      </div>
    </div>
  );
}

export function CompletedArchive() {
  const { tasks, archiveOpen, setArchiveOpen, navigateTo, getArchivedTasks } = useTaskContext();
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const archivedTasks = getArchivedTasks();

  const filteredTasks = searchQuery.trim()
    ? archivedTasks.filter(
        (t) =>
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
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      navigateTo(task.parentId);
      setArchiveOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-[#05080d]/80 backdrop-blur-md"
        onClick={() => setArchiveOpen(false)}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-4 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-[var(--op-border-strong)] bg-[#0a0e15] shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--op-border)] bg-black/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--op-muted)]">
            COMPLETED ARCHIVE
          </div>
          <button
            type="button"
            onClick={() => setArchiveOpen(false)}
            className="rounded p-1 text-[var(--op-dim)] transition-colors hover:text-[var(--op-text)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-[var(--op-border)] p-3">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived tasks..."
            className="w-full rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-[13px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-accent)] focus:outline-none"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filteredTasks.length === 0 ? (
            <p className="py-8 text-center font-mono text-[11px] text-[var(--op-dim)]">
              {searchQuery ? 'No matching archived tasks' : 'No archived tasks (older than 7 days)'}
            </p>
          ) : (
            filteredTasks.map((task) => {
              const path = getTaskPath(tasks, task.id);
              const breadcrumb = formatBreadcrumb(path.slice(0, -1), 40, false);

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleNavigate(task.id)}
                  className="group flex w-full flex-col rounded-xl border border-[var(--op-border)] bg-[var(--op-inset)] p-3 text-left transition-colors hover:border-[var(--op-border-strong)] hover:bg-white/[0.02]"
                >
                  <div className="font-mono text-[10px] uppercase text-[var(--op-dim)]">{breadcrumb}</div>
                  <div className="text-[13.5px] font-medium text-[var(--op-text)] group-hover:text-[var(--op-accent)] transition-colors">
                    {task.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{getCompletedAgoText(task)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--op-border)] p-3 text-center font-mono text-[10px] text-[var(--op-dim)]">
          {archivedTasks.length} task{archivedTasks.length !== 1 ? 's' : ''} completed more than 7 days ago
        </div>
      </div>
    </>
  );
}
