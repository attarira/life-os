'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useTaskContext } from '@/lib/task-context';
import { COLUMNS, TaskStatus } from '@/lib/types';
import { getTaskPath } from '@/lib/tasks';
import { Breadcrumb } from './Breadcrumb';
import { Column } from './Column';
import { TaskCard } from './TaskCard';

const CAREER_LINKS = {
  linkedin: 'https://www.linkedin.com/in/attarira',
  github: 'https://github.com/attarira',
  resume: 'https://docs.google.com/document/d/1gnqkl4Q5bSDd1YFLqFO8K6SPooKS-xUT/edit',
};

function resolveAreaKey(id: string) {
  const key = id.toLowerCase();
  if (key.includes('health') || key.includes('well')) return 'health';
  if (key.includes('finance') || key.includes('budget')) return 'finances';
  if (key.includes('relation') || key.includes('family') || key.includes('social')) return 'relationships';
  if (key.includes('career') || key.includes('work') || key.includes('job')) return 'career';
  if (key.includes('grow') || key.includes('learn') || key.includes('personal')) return 'growth';
  if (key.includes('recre') || key.includes('play') || key.includes('fun')) return 'recreation';
  return id;
}

export function KanbanBoard() {
  const {
    tasks,
    getVisibleChildren,
    moveTask,
    reorderTasks,
    setSearchOpen,
    setArchiveOpen,
    getArchivedTasks,
    currentParentId
  } = useTaskContext();

  const [activeId, setActiveId] = useState<string | null>(null);

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

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const path = getTaskPath(tasks, currentParentId);
  const rootArea = path[0];
  const showCareerResources = rootArea ? resolveAreaKey(rootArea.title || rootArea.id) === 'career' : false;

  return (
    <div className="flex flex-col h-full">
      {/* Header with Breadcrumb and Actions */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Breadcrumb />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showCareerResources && (
              <div className="flex items-center gap-1 mr-1">
                <a
                  href={CAREER_LINKS.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="LinkedIn"
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.45 20.45h-3.554v-5.568c0-1.328-.026-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.94v5.665H9.354V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.603 0 4.263 2.372 4.263 5.457v6.282zM5.337 7.433a2.063 2.063 0 01-2.062-2.062 2.063 2.063 0 112.062 2.062zM7.116 20.45H3.558V9h3.558v11.45zM22.225 0H1.771C.792 0 0 .774 0 1.727v20.546C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.273V1.727C24 .774 23.2 0 22.225 0z" />
                  </svg>
                </a>
                <a
                  href={CAREER_LINKS.github}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="GitHub"
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.11 3.29 9.44 7.86 10.97.58.1.79-.25.79-.56 0-.27-.01-1-.01-1.96-3.2.7-3.88-1.55-3.88-1.55-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.02 1.75 2.68 1.25 3.33.96.1-.74.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 012.9-.39c.99 0 1.99.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.77.12 3.06.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.28 5.68.41.36.78 1.07.78 2.16 0 1.56-.02 2.82-.02 3.2 0 .31.21.67.8.56 4.56-1.53 7.85-5.86 7.85-10.97C23.5 5.74 18.27.5 12 .5z" />
                  </svg>
                </a>
                <a
                  href={CAREER_LINKS.resume}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Resume (Docs)"
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h6l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v4h4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h6M9 9h3" />
                  </svg>
                </a>
              </div>
            )}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive ({archivedCount})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
          <div className="flex-1 min-h-0">
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
        </div>
      </div>
    </div>
  );
}
