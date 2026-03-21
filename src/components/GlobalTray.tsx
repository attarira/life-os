'use client';

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { NotificationsTray } from './NotificationsTray';
import { CurrencyToggle } from './CurrencyToggle';
import { BackupsPanel } from './BackupsPanel';
import { ArchiveInlinePanel } from './CompletedArchive';

/**
 * GlobalTray – always visible on every page.
 *
 * Contains:
 *  • Notifications bell
 *  • Search button
 *  • Settings gear (consolidated popover with Archives, Backups, Display Currency)
 */
export function GlobalTray() {
  const { setSearchOpen, getArchivedTasks } = useTaskContext();
  const archivedCount = getArchivedTasks().length;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'archive' | 'backups' | 'currency' | null>(null);
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
    <div className="flex items-center gap-1">
      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="Search (press /)"
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {/* Notifications */}
      <NotificationsTray />

      {/* Settings gear */}
      <div className="relative" ref={settingsRef}>
        <button
          onClick={() => {
            if (settingsOpen) {
              closeSettings();
              return;
            }
            setSettingsOpen(true);
          }}
          className={`p-2 rounded-lg transition-colors ${settingsOpen ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Settings"
          aria-label="Settings"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {settingsOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={closeSettings}
            />
            <div className="absolute right-0 top-full mt-2 w-72 z-50 rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-white/5">
              <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/80">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Settings</span>
              </div>

              <div className="p-1.5 space-y-0.5">
                <SettingsExpandableRow
                  label="Archive"
                  isExpanded={expandedSection === 'archive'}
                  onToggle={() => setExpandedSection(current => current === 'archive' ? null : 'archive')}
                  badge={archivedCount > 0 ? (
                    <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5 tabular-nums">
                      {archivedCount}
                    </span>
                  ) : null}
                  icon={(
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  )}
                >
                  <ArchiveInlinePanel onNavigate={closeSettings} />
                </SettingsExpandableRow>

                <SettingsExpandableRow
                  label="Backups"
                  isExpanded={expandedSection === 'backups'}
                  onToggle={() => setExpandedSection(current => current === 'backups' ? null : 'backups')}
                  icon={(
                    <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                >
                  <div className="px-1.5 pb-1">
                    <BackupsPanel inline />
                  </div>
                </SettingsExpandableRow>

                <SettingsExpandableRow
                  label="Display Currency"
                  isExpanded={expandedSection === 'currency'}
                  onToggle={() => setExpandedSection(current => current === 'currency' ? null : 'currency')}
                  icon={(
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M9 9.5c.5-.5 1.5-1 3-1s2.5.5 3 1.5-1 2-3 2-2.5.5-3 1.5 1 1.5 3 1.5 2.5-.5 3-1" />
                    </svg>
                  )}
                >
                  <div className="px-1 pb-1">
                    <CurrencyToggle inline />
                  </div>
                </SettingsExpandableRow>
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
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
      >
        {icon}
        <span>{label}</span>
        <div className="ml-auto flex items-center gap-2">
          {badge}
          <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-1">
          {children}
        </div>
      )}
    </div>
  );
}
