'use client';

import React, { useState, useEffect } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID } from '@/lib/types';
import { KanbanBoard } from './KanbanBoard';
import { HomeDashboard } from './HomeDashboard';
import { TaskPanel } from './TaskPanel';
import { SearchModal } from './SearchModal';
import { CompletedArchive } from './CompletedArchive';

export function Board() {
  const {
    currentParentId,
    isLoading,
    createTask,
    setSearchOpen,
    tasks, // Needed if we want validation or logic here
  } = useTaskContext();

  const [quickAddValue, setQuickAddValue] = useState('');

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


  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = quickAddValue.trim();
      if (trimmed) {
        // If at root, we need to know which area to add to.
        // For now, maybe disable quick add at root or force user to pick?
        // Let's rely on the specific board's input if inside a board.
        // But this handles the global state if we lift it up.
        // Actually, Board.tsx contained the sticky Header/QuickAdd.
        // Now KanbanBoard contains the Header.
        // So this Board.tsx is mainly a Router.

        if (currentParentId !== ROOT_TASK_ID) {
          await createTask({
            parentId: currentParentId,
            title: trimmed,
            status: 'NOT_STARTED',
            priority: 'MEDIUM',
          });
          setQuickAddValue('');
        }
      }
    }
  };

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

      {/* Quick Add overlay or global? 
          For now, KanbanBoard has its internal logic if we move it there.
          The previous implementation had Quick Add permanently fixed below Header.
          KanbanBoard needs to implement its own Quick Add if we want it there.
          I'll add Quick Add to KanbanBoard structure to keep it contextual.
      */}
    </div>
  );
}
