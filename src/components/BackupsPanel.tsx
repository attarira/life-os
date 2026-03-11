'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { Task } from '@/lib/types';
import { AUTO_BACKUP_KEY, FILE_SYSTEM_STORAGE_KEY } from '@/lib/storage-keys';

type BackupEntry = {
  id: string;
  createdAt: string;
  tasks: Task[];
  fileSystemNodes?: unknown[];
  plannerItems?: unknown[];
  netWorthSnapshots?: unknown[];
  subscriptions?: unknown[];
  notifications?: unknown[];
  currency?: string;
};

function isBackupEntry(value: unknown): value is BackupEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    Array.isArray(candidate.tasks) &&
    (candidate.fileSystemNodes === undefined || Array.isArray(candidate.fileSystemNodes)) &&
    (candidate.plannerItems === undefined || Array.isArray(candidate.plannerItems)) &&
    (candidate.netWorthSnapshots === undefined || Array.isArray(candidate.netWorthSnapshots)) &&
    (candidate.subscriptions === undefined || Array.isArray(candidate.subscriptions)) &&
    (candidate.notifications === undefined || Array.isArray(candidate.notifications)) &&
    (candidate.currency === undefined || typeof candidate.currency === 'string')
  );
}

function loadBackupEntries(): BackupEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isBackupEntry)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 7);
  } catch (error) {
    console.warn('Failed to load backups:', error);
    return [];
  }
}

function formatBackupTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}



export function BackupsPanel({ inline }: { inline?: boolean } = {}) {
  const { importTasks } = useTaskContext();
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refreshBackups = useCallback(() => {
    setBackups(loadBackupEntries());
  }, []);

  // When inline, load on mount; otherwise load when open
  useEffect(() => {
    if (inline) {
      refreshBackups();
      return;
    }
    if (!open) return;
    refreshBackups();
  }, [open, inline, refreshBackups]);



  const handleRestore = async (entry: BackupEntry) => {
    const backupLabel = formatBackupTimestamp(entry.createdAt);
    const hasFiles = Array.isArray(entry.fileSystemNodes);
    const confirmed = window.confirm(
      hasFiles
        ? `Restore backup from ${backupLabel}? This will replace current tasks and files.`
        : `Restore backup from ${backupLabel}? This will replace current tasks.`
    );
    if (!confirmed) return;

    try {
      setStatus(null);
      setRestoringId(entry.id);
      await importTasks(entry.tasks);
      if (hasFiles) {
        window.localStorage.setItem(FILE_SYSTEM_STORAGE_KEY, JSON.stringify(entry.fileSystemNodes));
        window.dispatchEvent(new Event('lifeos:file-system-updated'));
      }

      if (entry.plannerItems) {
        window.localStorage.setItem('lifeos:planner-items:v1', JSON.stringify(entry.plannerItems));
      }
      if (entry.netWorthSnapshots) {
        window.localStorage.setItem('lifeos:finance:netWorth:v1', JSON.stringify(entry.netWorthSnapshots));
      }
      if (entry.subscriptions) {
        window.localStorage.setItem('lifeos:finance:subscriptions:v1', JSON.stringify(entry.subscriptions));
      }
      if (entry.notifications) {
        window.localStorage.setItem('lifeos:notifications:v1', JSON.stringify(entry.notifications));
      }
      if (entry.currency) {
        window.localStorage.setItem('lifeos:currency', entry.currency);
      }

      setStatus(`Restoring from ${backupLabel}, refreshing page...`);
      window.location.reload();
    } catch (error) {
      console.error('Restore failed:', error);
      setStatus('Restore failed. Check console for details.');
    } finally {
      setRestoringId(null);
    }
  };

  // ── Inline mode: render compact list embedded inside settings ──
  if (inline) {
    return (
      <div className="rounded-lg bg-slate-800/50 max-h-48 overflow-y-auto">
        {status && (
          <div className="px-2 py-1.5">
            <div className="rounded border border-blue-900/50 bg-blue-950/30 px-2 py-1 text-[10px] font-medium text-blue-300">
              {status}
            </div>
          </div>
        )}
        {backups.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-slate-500">
            No backups found yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {backups.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-800/60 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-slate-200 truncate">
                    {formatBackupTimestamp(entry.createdAt)}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {entry.tasks.length} tasks
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(entry)}
                  disabled={restoringId === entry.id}
                  className="shrink-0 rounded border border-slate-600 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {restoringId === entry.id ? '...' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Standalone mode: trigger button + floating popover ──
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`relative p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors ${open ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}
        title="Backups"
        aria-label="Backups"
      >
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Daily Backups</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Stored in local browser storage
                </p>
              </div>
              <button
                type="button"
                onClick={refreshBackups}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh List"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {status && (
              <div className="px-4 py-2 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <div className="rounded border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 text-[11px] font-medium text-blue-800 dark:text-blue-300">
                  {status}
                </div>
              </div>
            )}

            <div className="overflow-y-auto p-2 space-y-1.5">
              {backups.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No backups found yet.
                </div>
              )}

              {backups.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-2 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">
                      {formatBackupTimestamp(entry.createdAt)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      {entry.tasks.length} tasks
                      {Array.isArray(entry.fileSystemNodes) ? ` • ${entry.fileSystemNodes.length} items` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(entry)}
                    disabled={restoringId === entry.id}
                    className="shrink-0 rounded border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {restoringId === entry.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
