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

  const isAtRoot = currentParentId === ROOT_TASK_ID;

  return (
    <nav className="flex items-center gap-2 text-sm font-light">
      <button
        onClick={() => navigateTo(ROOT_TASK_ID)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
      >
        <span className={`text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white ${isAtRoot ? 'font-semibold' : 'font-medium'}`}>
          LifeOS
        </span>
      </button>

      {path.map((item, index) => (
        <React.Fragment key={item.id}>
          <span className="text-slate-300 dark:text-slate-600 select-none">/</span>
          <button
            onClick={() => navigateTo(item.id)}
            className={`
              px-1.5 py-1 rounded transition-colors whitespace-nowrap
              ${index === path.length - 1
                ? 'text-slate-900 dark:text-white font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
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
