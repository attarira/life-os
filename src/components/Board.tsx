'use client';

import React, { useEffect } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID } from '@/lib/types';
import { KanbanBoard } from './KanbanBoard';
import { HomeDashboard } from './HomeDashboard';
import { TaskPanel } from './TaskPanel';
import { SearchModal } from './SearchModal';
import { CompletedArchive } from './CompletedArchive';
import { BackupsPanel } from './BackupsPanel';

export function Board() {
  const {
    currentParentId,
    isLoading,
    setSearchOpen,
  } = useTaskContext();

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditableTarget = Boolean(
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[contenteditable="true"]'))
      );
      if (isEditableTarget) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'n') {
        e.preventDefault();
        // If we are in Dashboard, maybe quick add is global? 
        // For now, let's keep quick add inside the boards or add a global one.
        // The original code targeted [data-quick-add] input.
        const input = document.querySelector<HTMLInputElement>('[data-quick-add]');
        input?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setSearchOpen]);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-lg text-slate-500 dark:text-slate-400 font-light">Loading LifeOS...</div>
      </div>
    );
  }

  // Routing Logic
  const isAtRoot = currentParentId === ROOT_TASK_ID;

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {isAtRoot ? (
          <HomeDashboard />
        ) : (
          <KanbanBoard />
        )}
      </main>

      {/* Global Modals */}
      <TaskPanel />
      <SearchModal />
      <CompletedArchive />
      <BackupsPanel />

      {/* Quick Add overlay or global? 
          For now, KanbanBoard has its internal logic if we move it there.
          The previous implementation had Quick Add permanently fixed below Header.
          KanbanBoard needs to implement its own Quick Add if we want it there.
          I'll add Quick Add to KanbanBoard structure to keep it contextual.
      */}
    </div>
  );
}
