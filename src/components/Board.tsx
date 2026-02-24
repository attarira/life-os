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
import { ChatPanel } from './ChatPanel';

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
  // Global Chat State
  const [isChatDrawerOpen, setIsChatDrawerOpen] = React.useState(false);
  const { tasks, navigateTo, selectTask } = useTaskContext();
  const chatContext = React.useMemo(
    () => ({ tasks, navigateTo, selectTask }),
    [tasks, navigateTo, selectTask]
  );

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
      {/* ─── Global Chat Drawer (LEFT) ─── */}
      <aside
        className={`hidden xl:block fixed left-0 top-[73px] bottom-0 z-40 transition-[width] duration-200 ${isChatDrawerOpen ? 'w-[330px]' : 'w-[56px]'
          }`}
      >
        <div className="h-full w-full rounded-r-2xl border-r border-t border-b border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-sm">
          <ChatPanel
            appContext={chatContext}
            collapsed={!isChatDrawerOpen}
            onToggle={() => setIsChatDrawerOpen((v) => !v)}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {isAtRoot ? (
          <HomeDashboard isChatDrawerOpen={isChatDrawerOpen} />
        ) : (
          <KanbanBoard isChatDrawerOpen={isChatDrawerOpen} />
        )}
      </main>

      {/* Global Modals */}
      <TaskPanel />
      <SearchModal />
      <CompletedArchive />
      <BackupsPanel />
    </div>
  );
}
