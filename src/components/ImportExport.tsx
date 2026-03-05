'use client';

import React, { useRef } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { FILE_SYSTEM_STORAGE_KEY, DASHBOARD_PAGES_STORAGE_KEY } from '@/lib/storage-keys';

export function ImportExport() {
  const { importTasks, exportTasks } = useTaskContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const tasks = await exportTasks();
      const fileSystemNodes = JSON.parse(localStorage.getItem(FILE_SYSTEM_STORAGE_KEY) || '[]');
      const plannerItems = JSON.parse(localStorage.getItem('lifeos:planner-items:v1') || '[]');
      const netWorthSnapshots = JSON.parse(localStorage.getItem('lifeos:finance:netWorth:v1') || '[]');
      const subscriptions = JSON.parse(localStorage.getItem('lifeos:finance:subscriptions:v1') || '[]');
      const notifications = JSON.parse(localStorage.getItem('lifeos:notifications:v1') || '[]');
      const currency = localStorage.getItem('lifeos:currency') || 'USD';

      const payload = {
        id: 'export-' + Date.now(),
        createdAt: new Date().toISOString(),
        tasks,
        fileSystemNodes,
        plannerItems,
        netWorthSnapshots,
        subscriptions,
        notifications,
        currency
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `kanban-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Check console for details.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        if (confirm(`Import ${data.length} tasks? This will replace all existing data.`)) {
          await importTasks(data);
          alert('Import successful!');
        }
      } else if (data && typeof data === 'object' && Array.isArray(data.tasks)) {
        if (confirm(`Import full backup? This will replace all existing tasks, configurations, and data.`)) {
          await importTasks(data.tasks);

          if (data.fileSystemNodes) localStorage.setItem(FILE_SYSTEM_STORAGE_KEY, JSON.stringify(data.fileSystemNodes));
          if (data.notesPages) localStorage.setItem(DASHBOARD_PAGES_STORAGE_KEY, JSON.stringify(data.notesPages)); // Fallback
          if (data.plannerItems) localStorage.setItem('lifeos:planner-items:v1', JSON.stringify(data.plannerItems));
          if (data.netWorthSnapshots) localStorage.setItem('lifeos:finance:netWorth:v1', JSON.stringify(data.netWorthSnapshots));
          if (data.subscriptions) localStorage.setItem('lifeos:finance:subscriptions:v1', JSON.stringify(data.subscriptions));
          if (data.notifications) localStorage.setItem('lifeos:notifications:v1', JSON.stringify(data.notifications));
          if (data.currency) localStorage.setItem('lifeos:currency', data.currency);

          window.dispatchEvent(new Event('lifeos:file-system-updated'));
          alert('Import successful! Page will reload.');
          window.location.reload();
        }
      } else {
        throw new Error('Invalid format: expected an array of tasks or a full backup object');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Check console for details.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
        title="Export to JSON"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>

      <label className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </label>
    </div>
  );
}
