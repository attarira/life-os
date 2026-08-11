'use client';

import React, { useMemo, useState } from 'react';
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
import { useTravelMode } from '@/lib/travel-mode-context';
import { COLUMNS, TaskStatus } from '@/lib/types';
import { getTaskPath } from '@/lib/tasks';
import { resolveAreaKey } from '@/lib/utils';
import { Breadcrumb } from './Breadcrumb';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { GlobalTray } from './GlobalTray';
import { LocalTray, CAREER_TRAY_ITEMS, RECREATION_TRAY_ITEMS, LocalTrayItem } from './LocalTray';
import { BirthdayModal } from './BirthdayModal';
import { TravelModeBoard } from './TravelModeBoard';
import { FinanceSection } from './FinanceSection';



export function KanbanBoard() {
  const { enabled } = useTravelMode();

  if (enabled) {
    return <TravelModeBoard />;
  }

  return <StandardKanbanBoard />;
}

function StandardKanbanBoard() {
  const {
    tasks,
    getVisibleChildren,
    moveTask,
    reorderTasks,
    currentParentId
  } = useTaskContext();

  const [activeId, setActiveId] = useState<string | null>(null);

  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);

  const visibleChildren = getVisibleChildren();

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
  const areaKey = rootArea ? resolveAreaKey(rootArea.title || rootArea.id) : '';
  const showCareerResources = areaKey === 'career';
  const showFinanceSections = areaKey === 'finances';
  const showRecreationMaps = areaKey === 'recreation';
  const showRelationshipsTray = areaKey === 'relationships';

  const RELATIONSHIPS_TRAY_ITEMS: LocalTrayItem[] = useMemo(() => [
    {
      type: 'button',
      onClick: () => setIsBirthdayModalOpen(true),
      label: 'Birthdays',
      icon: (
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
        </svg>
      )
    }
  ], []);



  return (
    <div className="op flex h-full flex-col text-[var(--op-text)]">
      {/* Header with Breadcrumb and Actions */}
      <header className="flex-shrink-0 border-b border-[var(--op-border)] bg-[#05080d]/85 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Breadcrumb />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showCareerResources && <LocalTray items={CAREER_TRAY_ITEMS} />}
            {showRelationshipsTray && <LocalTray items={RELATIONSHIPS_TRAY_ITEMS} />}
            {showRecreationMaps && <LocalTray items={RECREATION_TRAY_ITEMS} />}
            <GlobalTray />
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
          {showFinanceSections && <FinanceSection />}

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
      
      {/* Modals placed here */}
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} />
    </div>
  );
}
