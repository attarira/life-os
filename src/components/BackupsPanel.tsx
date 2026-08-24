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
      <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] p-1">
        {status && (
          <div className="p-1.5">
            <div className="rounded border border-[var(--op-accent)]/30 bg-[var(--op-accent)]/10 px-2 py-1 font-mono text-[10px] text-[var(--op-accent)]">
              {status}
            </div>
          </div>
        )}
        {backups.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-[var(--op-dim)]">
            No local backups found.
          </div>
        ) : (
          <div className="divide-y divide-[var(--op-border)]">
            {backups.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 px-2.5 py-2 transition-colors hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-[var(--op-text)]">
                    {formatBackupTimestamp(entry.createdAt)}
                  </p>
                  <p className="font-mono text-[9px] text-[var(--op-dim)]">
                    {entry.tasks.length} tasks {Array.isArray(entry.fileSystemNodes) ? `• ${entry.fileSystemNodes.length} files` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(entry)}
                  disabled={restoringId === entry.id}
                  className="shrink-0 rounded border border-[var(--op-border-strong)] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--op-sub)] transition-colors hover:border-[var(--op-accent)] hover:text-[var(--op-accent)] disabled:opacity-50"
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

  // ── Standalone mode ──
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
          open
            ? 'border-[var(--op-accent)] bg-[var(--op-accent)]/10 text-[var(--op-accent)]'
            : 'border-[var(--op-border-strong)] bg-white/[0.03] text-[var(--op-sub)] hover:border-[var(--op-accent)] hover:text-[var(--op-accent)]'
        }`}
        title="Backups"
        aria-label="Backups"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[400px] w-80 flex-col overflow-hidden rounded-xl border border-[var(--op-border-strong)] bg-[#0a0e15] shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[var(--op-border)] bg-black/40 px-3.5 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--op-muted)]">
                DAILY BACKUPS
              </div>
              <button
                type="button"
                onClick={refreshBackups}
                className="rounded p-1 text-[var(--op-dim)] transition-colors hover:text-[var(--op-text)]"
                title="Refresh List"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {status && (
              <div className="border-b border-[var(--op-border)] px-3 py-1.5 font-mono text-[10px] text-[var(--op-accent)]">
                {status}
              </div>
            )}

            <div className="overflow-y-auto p-2 space-y-1">
              {backups.length === 0 && (
                <div className="px-3 py-6 text-center font-mono text-[11px] text-[var(--op-dim)]">
                  No backups found yet.
                </div>
              )}

              {backups.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] p-2 transition-colors hover:border-[var(--op-border-strong)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] font-medium text-[var(--op-text)]">
                      {formatBackupTimestamp(entry.createdAt)}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--op-dim)]">
                      {entry.tasks.length} tasks {Array.isArray(entry.fileSystemNodes) ? `• ${entry.fileSystemNodes.length} files` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(entry)}
                    disabled={restoringId === entry.id}
                    className="shrink-0 rounded border border-[var(--op-border-strong)] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-[var(--op-sub)] hover:border-[var(--op-accent)] hover:text-[var(--op-accent)] disabled:opacity-50"
                  >
                    {restoringId === entry.id ? '...' : 'Restore'}
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
