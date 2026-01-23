'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useTaskContext } from '@/lib/task-context';
import { COLUMNS, TaskStatus, ROOT_TASK_ID } from '@/lib/types';
import { Breadcrumb } from './Breadcrumb';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { TaskPanel } from './TaskPanel';
import { SearchModal } from './SearchModal';
import { CompletedArchive } from './CompletedArchive';
import { ImportExport } from './ImportExport';

export function Board() {
  const {
    tasks,
    currentParentId,
    isLoading,
    getVisibleChildren,
    getArchivedTasks,
    moveTask,
    reorderTasks,
    createTask,
    setSearchOpen,
    setArchiveOpen,
  } = useTaskContext();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState('');

  const visibleChildren = getVisibleChildren();
  const archivedCount = getArchivedTasks().length;

  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = visibleChildren.filter(t => t.status === col.status);
    return acc;
  }, {} as Record<TaskStatus, typeof visibleChildren>);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'n') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-quick-add]');
        input?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setSearchOpen]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;

    // Check if dropping on a column
    const isColumn = COLUMNS.some(c => c.status === overId);

    if (isColumn) {
      // Dropped on empty column - move to that status
      const newStatus = overId as TaskStatus;
      if (activeTask.status !== newStatus) {
        const tasksInColumn = tasksByStatus[newStatus];
        const newOrder = tasksInColumn.length > 0
          ? Math.max(...tasksInColumn.map(t => t.order)) + 1
          : 0;
        await moveTask(activeTask.id, newStatus, newOrder);
      }
    } else {
      // Dropped on another task
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;

      if (activeTask.status !== overTask.status) {
        // Moving to different column
        await moveTask(activeTask.id, overTask.status, overTask.order);

        // Reorder tasks in target column
        const targetTasks = tasksByStatus[overTask.status];
        const newOrder = targetTasks
          .filter(t => t.id !== activeTask.id)
          .map(t => t.id);
        const overIndex = newOrder.indexOf(overTask.id);
        newOrder.splice(overIndex, 0, activeTask.id);
        await reorderTasks(newOrder, overTask.status);
      } else {
        // Reordering within same column
        const columnTasks = tasksByStatus[activeTask.status];
        const oldIndex = columnTasks.findIndex(t => t.id === active.id);
        const newIndex = columnTasks.findIndex(t => t.id === over.id);

        if (oldIndex !== newIndex) {
          const newOrder = arrayMove(columnTasks, oldIndex, newIndex).map(t => t.id);
          await reorderTasks(newOrder, activeTask.status);
        }
      }
    }
  };

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = quickAddValue.trim();
      if (trimmed) {
        await createTask({
          parentId: currentParentId,
          title: trimmed,
          status: 'NOT_STARTED',
        });
        setQuickAddValue('');
      }
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex-shrink-0">
              📋 Kanban
            </h1>
            <Breadcrumb />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              title="Search (press /)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {archivedCount > 0 && (
              <button
                onClick={() => setArchiveOpen(true)}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                title="View archived completed tasks"
              >
                <span>📦</span>
                Archive ({archivedCount})
              </button>
            )}

            <ImportExport />
          </div>
        </div>
      </header>

      {/* Quick add */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <input
            data-quick-add
            type="text"
            value={quickAddValue}
            onChange={(e) => setQuickAddValue(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="Quick add task (press Enter)... (n to focus, / to search)"
            className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Board */}
      <main className="flex-1 overflow-hidden p-4">
        <div className="max-w-7xl mx-auto h-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
              {COLUMNS.map(col => (
                <Column
                  key={col.status}
                  status={col.status}
                  label={col.label}
                  color={col.color}
                  tasks={tasksByStatus[col.status]}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="rotate-3">
                  <TaskCard task={activeTask} isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      {/* Modals */}
      <TaskPanel />
      <SearchModal />
      <CompletedArchive />
    </div>
  );
}
