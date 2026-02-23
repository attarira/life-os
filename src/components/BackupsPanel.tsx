'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { Task } from '@/lib/types';
import { AUTO_BACKUP_KEY, DASHBOARD_PAGES_STORAGE_KEY } from '@/lib/storage-keys';

type BackupEntry = {
  id: string;
  createdAt: string;
  tasks: Task[];
  notesPages?: unknown[];
};

function isBackupEntry(value: unknown): value is BackupEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown; createdAt?: unknown; tasks?: unknown; notesPages?: unknown };
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    Array.isArray(candidate.tasks) &&
    (candidate.notesPages === undefined || Array.isArray(candidate.notesPages))
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

function downloadJSON(filename: string, data: unknown) {
  const payload = JSON.stringify(data, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function BackupsPanel() {
  const { importTasks } = useTaskContext();
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refreshBackups = useCallback(() => {
    setBackups(loadBackupEntries());
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshBackups();
  }, [open, refreshBackups]);

  const handleDownload = (entry: BackupEntry) => {
    const dateKey = entry.createdAt.split('T')[0] || 'backup';
    downloadJSON(`lifeos-backup-${dateKey}.json`, entry);
    setStatus(`Downloaded backup from ${formatBackupTimestamp(entry.createdAt)}.`);
  };

  const handleRestore = async (entry: BackupEntry) => {
    const backupLabel = formatBackupTimestamp(entry.createdAt);
    const hasNotes = Array.isArray(entry.notesPages);
    const confirmed = window.confirm(
      hasNotes
        ? `Restore backup from ${backupLabel}? This will replace current tasks and notes.`
        : `Restore backup from ${backupLabel}? This will replace current tasks.`
    );
    if (!confirmed) return;

    try {
      setStatus(null);
      setRestoringId(entry.id);
      await importTasks(entry.tasks);
      if (hasNotes) {
        window.localStorage.setItem(DASHBOARD_PAGES_STORAGE_KEY, JSON.stringify(entry.notesPages));
        window.dispatchEvent(new Event('lifeos:notes-storage-updated'));
      }
      setStatus(
        hasNotes
          ? `Restored tasks and notes from ${backupLabel}.`
          : `Restored tasks from ${backupLabel}.`
      );
      refreshBackups();
    } catch (error) {
      console.error('Restore failed:', error);
      setStatus('Restore failed. Check console for details.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-20 z-40 inline-flex items-center gap-2 rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-lg"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Backups
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Daily Backups</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Stored in local browser storage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close backups panel"
              >
                <svg className="w-4 h-4 mx-auto" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {status && (
              <div className="px-4 pt-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  {status}
                </div>
              </div>
            )}

            <div className="px-4 py-4 space-y-3 overflow-y-auto h-[calc(100%-134px)]">
              {backups.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                  No backups found yet. A backup is created once per day after app load.
                </div>
              )}

              {backups.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/70 px-3 py-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {formatBackupTimestamp(entry.createdAt)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.tasks.length} tasks
                        {Array.isArray(entry.notesPages) ? ` • ${entry.notesPages.length} notes` : ' • notes not included'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(entry)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                    >
                      Download JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(entry)}
                      disabled={restoringId === entry.id}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {restoringId === entry.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
              <button
                type="button"
                onClick={refreshBackups}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Refresh List
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
