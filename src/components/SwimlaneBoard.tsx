'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTaskContext } from '@/lib/task-context';
import { COLUMNS, TaskStatus, ROOT_TASK_ID, Task } from '@/lib/types';
import { Swimlane } from './Swimlane';
import { getThemeColor } from '@/lib/color-utils';

export function SwimlaneBoard() {
  const { tasks, getVisibleChildren, createTask } = useTaskContext();

  const rootTasks = tasks
    .filter(t => t.parentId === ROOT_TASK_ID)
    .sort((a, b) => a.order - b.order);

  const tasksByParent = tasks.reduce((acc, task) => {
    if (!acc[task.parentId]) acc[task.parentId] = [];
    acc[task.parentId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="h-full overflow-y-auto pr-2 pb-20">
      {/* Global Header - Sticky */}
      <div className="sticky top-0 z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4 pt-1">
        {COLUMNS.map(col => (
          <div key={col.status} className="flex items-center gap-2 px-2">
            <div className={`w-3 h-3 rounded-full ${col.color}`} />
            <h2 className="font-semibold text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">{col.label}</h2>
          </div>
        ))}
      </div>

      {/* Swimlanes */}
      <div className="space-y-6">
        <SortableContext items={rootTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {rootTasks.map(groupTask => {
            const groupChildren = tasksByParent[groupTask.id] || [];
            const theme = getThemeColor(groupTask.id);

            // Group children by status
            const tasksByStatus = COLUMNS.reduce((acc, col) => {
              acc[col.status] = groupChildren
                .filter(t => t.status === col.status)
                .sort((a, b) => a.order - b.order);
              return acc;
            }, {} as Record<TaskStatus, Task[]>);

            return (
              <Swimlane
                key={groupTask.id}
                groupTask={groupTask}
                columns={COLUMNS}
                tasksByStatus={tasksByStatus}
                theme={theme}
              />
            );
          })}
        </SortableContext>

        {rootTasks.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <p>No areas found. Create a task at the root level to start a new swimlane.</p>
          </div>
        )}
      </div>
    </div>
  );
}
