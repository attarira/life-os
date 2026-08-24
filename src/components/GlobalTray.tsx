'use client';

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { useTravelMode } from '@/lib/travel-mode-context';
import { NotificationsTray } from './NotificationsTray';
import { ArchiveInlinePanel } from './CompletedArchive';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * GlobalTray – always visible on every page.
 * Styled in the MILES-OS / Operator Console aesthetic.
 *
 * Contains:
 *  • Search button (with hotkey hint)
 *  • Travel Mode status badge
 *  • Notifications bell
 *  • Settings gear (consolidated popover with Travel Mode, Archives, Backups, Display Currency, Cloud Sync)
 */
export function GlobalTray() {
  const { setSearchOpen, getArchivedTasks } = useTaskContext();
  const { enabled, setEnabled } = useTravelMode();
  const archivedCount = getArchivedTasks().length;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'archive' | 'cloud' | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const closeSettings = () => {
    setSettingsOpen(false);
    setExpandedSection(null);
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        closeSettings();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  return (
    <div className="flex items-center gap-1.5 font-sans">
      {/* Search Button */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="group flex h-7 items-center gap-1.5 rounded-md border border-[var(--op-border-strong)] bg-white/[0.03] px-2 text-[var(--op-sub)] transition-colors hover:border-[var(--op-accent)] hover:text-[var(--op-accent)]"
        title="Search tasks (Press / or Cmd+K)"
        aria-label="Search"
      >
        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[var(--op-muted)] group-hover:text-[var(--op-accent)] sm:inline">
          Search
        </span>
        <kbd className="hidden rounded bg-white/[0.06] px-1 py-0.2 font-mono text-[9px] text-[var(--op-dim)] group-hover:text-[var(--op-accent)] md:inline-block">
          /
        </kbd>
      </button>

      {/* Travel Mode Active Pill */}
      {enabled && (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Travel
        </span>
      )}

      {/* Notifications Tray */}
      {!enabled && <NotificationsTray />}

      {/* Settings Gear Popover */}
      <div className="relative" ref={settingsRef}>
        <button
          type="button"
          onClick={() => {
            if (settingsOpen) {
              closeSettings();
              return;
            }
            setSettingsOpen(true);
          }}
          className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
            settingsOpen
              ? 'border-[var(--op-accent)] bg-[var(--op-accent)]/10 text-[var(--op-accent)]'
              : 'border-[var(--op-border-strong)] bg-white/[0.03] text-[var(--op-sub)] hover:border-[var(--op-accent)] hover:text-[var(--op-accent)]'
          }`}
          title="Settings & System Console"
          aria-label="Settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeSettings} />
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--op-border-strong)] bg-[#0a0e15] shadow-2xl backdrop-blur-md">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--op-border)] bg-black/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                  <span className="text-[var(--op-dim)]">00</span>
                  <span className="text-[var(--op-dim)]">{'//'}</span>
                  <span className="text-[var(--op-muted)]">SYSTEM SETTINGS</span>
                </div>
                {enabled && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                    Travel ON
                  </span>
                )}
              </div>

              {/* Setting Rows */}
              <div className="space-y-1 p-2">
                {!enabled && (
                  <>
                    {/* Archive Row */}
                    <SettingsExpandableRow
                      label="Completed Archive"
                      isExpanded={expandedSection === 'archive'}
                      onToggle={() => setExpandedSection((curr) => (curr === 'archive' ? null : 'archive'))}
                      badge={
                        archivedCount > 0 ? (
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-[var(--op-sub)] tabular-nums">
                            {archivedCount}
                          </span>
                        ) : null
                      }
                      icon={
                        <svg className="h-4 w-4 text-[var(--op-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      }
                    >
                      <div className="rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] p-1.5">
                        <ArchiveInlinePanel onNavigate={closeSettings} />
                      </div>
                    </SettingsExpandableRow>

                    {/* Cloud Integration Status Row */}
                    <SettingsExpandableRow
                      label="Cloud Sync & Integrations"
                      isExpanded={expandedSection === 'cloud'}
                      onToggle={() => setExpandedSection((curr) => (curr === 'cloud' ? null : 'cloud'))}
                      badge={
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${
                            isSupabaseConfigured
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {isSupabaseConfigured ? 'CONNECTED' : 'LOCAL'}
                        </span>
                      }
                      icon={
                        <svg className="h-4 w-4 text-[var(--op-dim)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                        </svg>
                      }
                    >
                      <div className="rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-[var(--op-text)]">Supabase Database</span>
                          <span
                            className={`font-mono text-[10px] ${
                              isSupabaseConfigured ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {isSupabaseConfigured ? '● Active' : '○ Standalone'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--op-muted)]">
                          {isSupabaseConfigured
                            ? 'Synchronized with cloud database across devices and real-time updates.'
                            : 'Running in local persistence mode (IndexedDB / LocalStorage).'}
                        </p>
                      </div>
                    </SettingsExpandableRow>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsExpandableRow({
  label,
  icon,
  badge,
  isExpanded,
  onToggle,
  children,
}: {
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-[12.5px] font-medium text-[var(--op-text)]">{label}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {badge}
          <svg
            className={`h-3 w-3 text-[var(--op-dim)] transition-transform duration-150 ${
              isExpanded ? 'rotate-90 text-[var(--op-accent)]' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {isExpanded && <div className="mt-1 px-1">{children}</div>}
    </div>
  );
}
