'use client';

import React from 'react';

/**
 * Shared shell for the operator-dashboard cards.
 * Renders the numbered "01 // TITLE" monospace header strip in the
 * MILES-OS console styling (hairline border, faint panel, teal accents).
 */
export function CardShell({
  index,
  title,
  right,
  children,
  className = '',
  bodyClassName = '',
}: {
  index: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] backdrop-blur-sm ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--op-border)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span className="tabular-nums text-[var(--op-dim)]">{index}</span>
          <span className="text-[var(--op-dim)]">{'//'}</span>
          <h2 className="truncate text-[var(--op-muted)]">{title}</h2>
        </div>
        {right ? <div className="flex flex-shrink-0 items-center gap-2">{right}</div> : null}
      </header>
      <div className={`flex-1 p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
