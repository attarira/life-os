'use client';

import React, { useEffect, useState } from 'react';
import { Task } from '@/lib/types';
import { GlobalTray } from '../GlobalTray';

export function TopNav({
  lifeAreas,
  onNavigate,
  onAddArea,
  onExport,
  initials,
  leftPad = '',
}: {
  lifeAreas: Task[];
  onNavigate: (id: string) => void;
  onAddArea: () => void;
  onExport: () => void;
  initials: string;
  leftPad?: string;
}) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
  const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <header className="sticky top-0 z-30 flex-shrink-0 border-b border-[var(--op-border)] bg-[#05080d]/85 backdrop-blur-md">
      <div className={`mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-5 ${leftPad}`}>
        {/* Brand */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--op-accent)] shadow-[0_0_8px_var(--op-accent)]" />
          <span className="text-[12px] font-semibold tracking-[0.16em] text-[var(--op-text)]">LIFE OS</span>
          <span className="font-mono text-[10px] tracking-wider text-[var(--op-dim)]">{'// V0'}</span>
        </div>

        {/* Section nav — Home + life areas */}
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          <span className="rounded-md border border-[var(--op-border-strong)] bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-text)]">
            Home
          </span>
          {lifeAreas.map((area) => (
            <button
              key={area.id}
              onClick={() => onNavigate(area.id)}
              className="whitespace-nowrap rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--op-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--op-text)]"
            >
              {area.title}
            </button>
          ))}
          <button
            onClick={onAddArea}
            className="ml-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[var(--op-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--op-text)]"
            title="Add life area"
            aria-label="Add life area"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </nav>

        {/* Right cluster */}
        <div className="flex flex-shrink-0 items-center gap-2.5">
          <div className="hidden items-center md:flex">
            <GlobalTray />
          </div>

          <button
            onClick={onExport}
            className="hidden items-center gap-1.5 rounded-md border border-[var(--op-border-strong)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--op-sub)] transition-colors hover:border-[var(--op-accent)] hover:text-[var(--op-accent)] sm:inline-flex"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Export
          </button>

          <span className="hidden items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-rose-300 lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Demo On
          </span>

          <span className="hidden font-mono text-[10px] tabular-nums tracking-wide text-[var(--op-muted)] lg:inline" suppressHydrationWarning>{dateLabel}</span>
          <span className="font-mono text-[12px] font-medium tabular-nums tracking-wide text-[var(--op-text)]" suppressHydrationWarning>{timeLabel}</span>

          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[var(--op-border-strong)] bg-white/[0.03] font-mono text-[10px] font-semibold tracking-wider text-[var(--op-sub)]">
            {initials}
          </span>
        </div>
      </div>
    </header>
  );
}
