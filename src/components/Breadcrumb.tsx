'use client';

import React from 'react';
import { useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID } from '@/lib/types';
import { getTaskPath } from '@/lib/tasks';

export function Breadcrumb() {
  const { tasks, currentParentId, navigateTo } = useTaskContext();

  const path = currentParentId === ROOT_TASK_ID
    ? []
    : getTaskPath(tasks, currentParentId);

  const items = [
    { id: ROOT_TASK_ID, title: 'Root' },
    ...path.map(t => ({ id: t.id, title: t.title })),
  ];

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && (
            <span className="text-slate-400 flex-shrink-0">›</span>
          )}
          <button
            onClick={() => navigateTo(item.id)}
            className={`
              flex-shrink-0 px-2 py-1 rounded transition-colors
              ${item.id === currentParentId
                ? 'text-slate-900 dark:text-white font-medium bg-slate-100 dark:bg-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
              }
            `}
          >
            {item.title}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
