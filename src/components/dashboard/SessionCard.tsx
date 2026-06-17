'use client';

import React, { useEffect, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { ROOT_TASK_ID } from '@/lib/types';

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function tzLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const region = tz.split('/').pop()?.replace(/_/g, ' ') || 'Local';
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '−';
    const hrs = Math.floor(Math.abs(offsetMin) / 60);
    return `${region} · UTC${sign}${hrs}`;
  } catch {
    return 'Local';
  }
}

export function SessionCard({ name }: { name: string }) {
  const { createTask } = useTaskContext();
  const [now, setNow] = useState<Date>(() => new Date());
  const [capture, setCapture] = useState('');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const submitCapture = async () => {
    const trimmed = capture.trim();
    if (!trimmed) return;
    const task = await createTask({
      parentId: ROOT_TASK_ID,
      title: trimmed,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      calendarOnly: true,
    });
    window.dispatchEvent(new CustomEvent('lifeos:planner-add', { detail: { task } }));
    setCapture('');
    setFlash(true);
    setTimeout(() => setFlash(false), 1100);
  };

  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <section className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--op-border)] bg-[var(--op-panel)] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-[var(--op-dim)]">{'02 // SESSION'}</span>
        <span className="text-[var(--op-muted)]" suppressHydrationWarning>{tzLabel()}</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 suppressHydrationWarning className="op-serif text-[28px] leading-tight text-[var(--op-text)]">
            {greeting(now.getHours())}, <span className="italic font-light">{name}.</span>
          </h1>
          <p suppressHydrationWarning className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--op-muted)]">{dateLabel}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div suppressHydrationWarning className="font-mono text-[34px] font-light leading-none tabular-nums text-[var(--op-text)]">
            {time}
            <span className="ml-1 align-top text-[16px] text-[var(--op-dim)]">{seconds}</span>
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-muted)]">Local time</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] pl-3 pr-1.5 py-1.5 transition-colors focus-within:border-[var(--op-border-strong)]">
        <span className="font-mono text-[12px] text-[var(--op-dim)]">⌘</span>
        <input
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitCapture(); }}
          placeholder={flash ? 'Captured to planner ✓' : 'Capture'}
          className={`flex-1 bg-transparent text-[13px] text-[var(--op-text)] focus:outline-none ${flash ? 'placeholder:text-[var(--op-accent)]' : 'placeholder:text-[var(--op-dim)]'}`}
        />
        <button
          onClick={submitCapture}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--op-border-strong)] bg-[var(--op-accent-dim)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--op-accent)] transition-colors hover:bg-[var(--op-accent)]/20"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
          Capture
        </button>
      </div>
    </section>
  );
}
