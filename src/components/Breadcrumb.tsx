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
    <nav className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em]">
      <button
        onClick={() => navigateTo(ROOT_TASK_ID)}
        className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--op-accent)] shadow-[0_0_8px_var(--op-accent)]" />
          <span className={isAtRoot ? 'text-[var(--op-text)]' : 'text-[var(--op-sub)]'}>Life OS</span>
        </span>
      </button>

      {path.map((item, index) => (
        <React.Fragment key={item.id}>
          <span className="select-none text-[var(--op-dim)]">/</span>
          <button
            onClick={() => navigateTo(item.id)}
            className={`whitespace-nowrap rounded-md px-1.5 py-1 transition-colors ${
              index === path.length - 1
                ? 'text-[var(--op-text)]'
                : 'text-[var(--op-muted)] hover:bg-white/[0.04] hover:text-[var(--op-text)]'
            }`}
          >
            {item.title}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
