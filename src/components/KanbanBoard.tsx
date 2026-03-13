'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useTaskContext } from '@/lib/task-context';
import { COLUMNS, TaskStatus } from '@/lib/types';
import { getTaskPath } from '@/lib/tasks';
import { generateId, resolveAreaKey, storage } from '@/lib/utils';
import { Breadcrumb } from './Breadcrumb';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { GlobalTray } from './GlobalTray';
import { LocalTray, CAREER_TRAY_ITEMS, RECREATION_TRAY_ITEMS, LocalTrayItem } from './LocalTray';
import { BirthdayModal } from './BirthdayModal';
import { useCurrency } from '@/lib/currency-context';

type NetWorthSnapshot = {
  id: string;
  date: string;
  assets: number;
  liabilities: number;
};

type SubscriptionCategory = 'entertainment' | 'utilities' | 'productivity' | 'health' | 'other';

type SubscriptionItem = {
  id: string;
  name: string;
  cost: number;
  billing: 'monthly' | 'yearly';
  active: boolean;
  category: SubscriptionCategory;
  paymentMethod?: string;
  dueDate?: string;
};

const CATEGORY_COLORS: Record<SubscriptionCategory, string> = {
  entertainment: 'bg-indigo-500',
  utilities: 'bg-emerald-500',
  productivity: 'bg-blue-500',
  health: 'bg-rose-500',
  other: 'bg-slate-500',
};

const CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
  entertainment: 'Entertainment',
  utilities: 'Utilities',
  productivity: 'Productivity',
  health: 'Health',
  other: 'Other',
};

const FINANCE_NET_WORTH_KEY = 'lifeos:finance:netWorth:v1';
const FINANCE_SUBSCRIPTIONS_KEY = 'lifeos:finance:subscriptions:v1';



function loadNetWorthSnapshots(): NetWorthSnapshot[] {
  const parsed = storage.get<any[]>(FINANCE_NET_WORTH_KEY, []);
  if (Array.isArray(parsed)) {
    return parsed
      .filter(Boolean)
      .map((item) => {
        const d = new Date();
        const fallbackDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return {
          id: String(item.id || generateId()),
          date: String(item.date || fallbackDate),
          assets: Number(item.assets || 0),
          liabilities: Number(item.liabilities || 0),
        };
      });
  }
  return [];
}

function loadSubscriptions(): SubscriptionItem[] {
  const parsed = storage.get<any[]>(FINANCE_SUBSCRIPTIONS_KEY, []);
  if (Array.isArray(parsed)) {
    return parsed
      .filter(Boolean)
      .map((item) => ({
        id: String(item.id || generateId()),
        name: String(item.name || 'Subscription'),
        cost: Number(item.cost || 0),
        billing: item.billing === 'yearly' ? 'yearly' : 'monthly',
        active: item.active !== false,
        category: (item.category as SubscriptionCategory) || 'other',
        paymentMethod: item.paymentMethod ? String(item.paymentMethod) : undefined,
        dueDate: item.dueDate ? String(item.dueDate) : undefined,
      }));
  }
  return [];
}


export function KanbanBoard({ isChatDrawerOpen, isChatExpanded }: { isChatDrawerOpen?: boolean, isChatExpanded?: boolean }) {
  const {
    tasks,
    getVisibleChildren,
    moveTask,
    reorderTasks,
    currentParentId
  } = useTaskContext();
  const { formatAmount } = useCurrency();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [netWorthSnapshots, setNetWorthSnapshots] = useState<NetWorthSnapshot[]>(() => loadNetWorthSnapshots());
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(() => loadSubscriptions());
  const d = new Date();
  const initialSnapshotDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [snapshotDate, setSnapshotDate] = useState(initialSnapshotDate);
  const [snapshotAssets, setSnapshotAssets] = useState('');
  const [snapshotLiabilities, setSnapshotLiabilities] = useState('');
  const [showNetWorthHistory, setShowNetWorthHistory] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<{ date: string; assets: string; liabilities: string }>({ date: '', assets: '', liabilities: '' });
  const [subscriptionName, setSubscriptionName] = useState('');
  const [subscriptionCost, setSubscriptionCost] = useState('');
  const [subscriptionBilling, setSubscriptionBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [subscriptionCategory, setSubscriptionCategory] = useState<SubscriptionCategory>('other');
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState('');
  const [subscriptionDueDate, setSubscriptionDueDate] = useState('');
  const [showAddSubscription, setShowAddSubscription] = useState(false);

  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);

  const visibleChildren = getVisibleChildren();

  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = visibleChildren.filter(t => t.status === col.status);
    return acc;
  }, {} as Record<TaskStatus, typeof visibleChildren>);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;

    // Check if dropping on a column
    const isColumn = COLUMNS.some(c => c.status === overId);

    if (isColumn) {
      // Dropped on empty column - move to that status
      const newStatus = overId as TaskStatus;
      if (activeTask.status !== newStatus) {
        const tasksInColumn = tasksByStatus[newStatus];
        const newOrder = tasksInColumn.length > 0
          ? Math.max(...tasksInColumn.map(t => t.order)) + 1
          : 0;
        await moveTask(activeTask.id, newStatus, newOrder);
      }
    } else {
      // Dropped on another task
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) return;

      if (activeTask.status !== overTask.status) {
        // Moving to different column
        await moveTask(activeTask.id, overTask.status, overTask.order);

        // Reorder tasks in target column
        const targetTasks = tasksByStatus[overTask.status];
        const newOrder = targetTasks
          .filter(t => t.id !== activeTask.id)
          .map(t => t.id);
        const overIndex = newOrder.indexOf(overTask.id);
        newOrder.splice(overIndex, 0, activeTask.id);
        await reorderTasks(newOrder, overTask.status);
      } else {
        // Reordering within same column
        const columnTasks = tasksByStatus[activeTask.status];
        const oldIndex = columnTasks.findIndex(t => t.id === active.id);
        const newIndex = columnTasks.findIndex(t => t.id === over.id);

        if (oldIndex !== newIndex) {
          const newOrder = arrayMove(columnTasks, oldIndex, newIndex).map(t => t.id);
          await reorderTasks(newOrder, activeTask.status);
        }
      }
    }
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const path = getTaskPath(tasks, currentParentId);
  const rootArea = path[0];
  const areaKey = rootArea ? resolveAreaKey(rootArea.title || rootArea.id) : '';
  const showCareerResources = areaKey === 'career';
  const showFinanceSections = areaKey === 'finances';
  const showRecreationMaps = areaKey === 'recreation';
  const showRelationshipsTray = areaKey === 'relationships';

  const RELATIONSHIPS_TRAY_ITEMS: LocalTrayItem[] = useMemo(() => [
    {
      type: 'button',
      onClick: () => setIsBirthdayModalOpen(true),
      label: 'Birthdays',
      icon: (
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="8" width="18" height="4" rx="1" />
          <path d="M12 8v13" />
          <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
        </svg>
      )
    }
  ], []);

  useEffect(() => {
    storage.set(FINANCE_NET_WORTH_KEY, netWorthSnapshots);
  }, [netWorthSnapshots]);

  useEffect(() => {
    storage.set(FINANCE_SUBSCRIPTIONS_KEY, subscriptions);
  }, [subscriptions]);

  const sortedSnapshots = useMemo(() => {
    return netWorthSnapshots.slice().sort((a, b) => b.date.localeCompare(a.date));
  }, [netWorthSnapshots]);

  const latestSnapshot = sortedSnapshots.length > 0 ? sortedSnapshots[0] : null;
  const previousSnapshot = sortedSnapshots.length > 1 ? sortedSnapshots[1] : null;

  const latestNetWorth = latestSnapshot
    ? latestSnapshot.assets - latestSnapshot.liabilities
    : 0;

  const previousNetWorth = previousSnapshot
    ? previousSnapshot.assets - previousSnapshot.liabilities
    : null;

  const trendPercent = previousNetWorth !== null && previousNetWorth !== 0
    ? ((latestNetWorth - previousNetWorth) / Math.abs(previousNetWorth)) * 100
    : null;

  const activeSubscriptions = subscriptions.filter((s) => s.active);
  const monthlySubscriptionTotal = activeSubscriptions.reduce((sum, item) => {
    if (item.billing === 'monthly') return sum + item.cost;
    return sum + (item.cost / 12);
  }, 0);

  const handleAddNetWorthSnapshot = () => {
    const assets = Number(snapshotAssets);
    const liabilities = Number(snapshotLiabilities);
    if (!snapshotDate || Number.isNaN(assets) || Number.isNaN(liabilities)) return;

    const next: NetWorthSnapshot = {
      id: generateId(),
      date: snapshotDate,
      assets,
      liabilities,
    };
    setNetWorthSnapshots((prev) => [next, ...prev]);
    setSnapshotAssets('');
    setSnapshotLiabilities('');
  };

  const handleAddSubscription = () => {
    const cost = Number(subscriptionCost);
    const trimmedName = subscriptionName.trim();
    if (!trimmedName || Number.isNaN(cost)) return;
    const next: SubscriptionItem = {
      id: generateId(),
      name: trimmedName,
      cost,
      billing: subscriptionBilling,
      active: true,
      category: subscriptionCategory,
      paymentMethod: subscriptionPaymentMethod.trim() || undefined,
      dueDate: subscriptionDueDate.trim() || undefined,
    };
    setSubscriptions((prev) => [next, ...prev]);
    setSubscriptionName('');
    setSubscriptionCost('');
    setSubscriptionBilling('monthly');
    setSubscriptionCategory('other');
    setSubscriptionPaymentMethod('');
    setSubscriptionDueDate('');
    setShowAddSubscription(false);
  };

  const toggleSubscription = (id: string) => {
    setSubscriptions((prev) => prev.map((item) => (
      item.id === id ? { ...item, active: !item.active } : item
    )));
  };

  const deleteSubscription = (id: string) => {
    setSubscriptions((prev) => prev.filter((item) => item.id !== id));
  };

  const startEditingSnapshot = (snap: NetWorthSnapshot) => {
    setEditingSnapshotId(snap.id);
    setEditingSnapshot({
      date: snap.date,
      assets: String(snap.assets),
      liabilities: String(snap.liabilities),
    });
  };

  const saveEditingSnapshot = () => {
    if (!editingSnapshotId) return;
    const assets = Number(editingSnapshot.assets);
    const liabilities = Number(editingSnapshot.liabilities);
    if (Number.isNaN(assets) || Number.isNaN(liabilities) || !editingSnapshot.date) return;
    setNetWorthSnapshots((prev) =>
      prev.map((snap) =>
        snap.id === editingSnapshotId
          ? { ...snap, date: editingSnapshot.date, assets, liabilities }
          : snap
      )
    );
    setEditingSnapshotId(null);
  };

  const cancelEditingSnapshot = () => {
    setEditingSnapshotId(null);
  };

  const deleteSnapshot = (id: string) => {
    setNetWorthSnapshots((prev) => prev.filter((snap) => snap.id !== id));
    if (editingSnapshotId === id) setEditingSnapshotId(null);
  };

  const leftPad = isChatDrawerOpen ? (isChatExpanded ? 'xl:pl-[600px]' : 'xl:pl-[330px]') : 'xl:pl-[56px]';

  return (
    <div className={`flex flex-col h-full transition-[padding] duration-200 ${leftPad}`}>
      {/* Header with Breadcrumb and Actions */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Breadcrumb />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showCareerResources && <LocalTray items={CAREER_TRAY_ITEMS} />}
            {showRelationshipsTray && <LocalTray items={RELATIONSHIPS_TRAY_ITEMS} />}
            {showRecreationMaps && <LocalTray items={RECREATION_TRAY_ITEMS} />}
            <GlobalTray />
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
          {showFinanceSections && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
              {/* ─── Net Worth Card ─── */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 flex flex-col">
                <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Net Worth</h3>
                    <div className="flex items-center gap-2">
                      {sortedSnapshots.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowNetWorthHistory(!showNetWorthHistory)}
                          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          title={showNetWorthHistory ? 'Hide history' : 'Show history'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {latestSnapshot ? latestSnapshot.date : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatAmount(latestNetWorth, { maximumFractionDigits: 0 })}
                    </span>
                    {trendPercent !== null && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${trendPercent >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
                        }`}>
                        <svg className={`w-3 h-3 ${trendPercent < 0 ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {Math.abs(trendPercent).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {/* Horizontal Quick Stats */}
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Assets</span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatAmount(latestSnapshot?.assets ?? 0, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Liabilities</span>
                      <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatAmount(latestSnapshot?.liabilities ?? 0, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Snapshot History */}
                {showNetWorthHistory && sortedSnapshots.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700/50">
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">History</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {/* Table Header */}
                      <div className="grid grid-cols-[100px_1fr_1fr_1fr_36px] gap-2 items-center px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sticky top-0 bg-white dark:bg-slate-800/70">
                        <span>Date</span>
                        <span className="text-right">Assets</span>
                        <span className="text-right">Liabilities</span>
                        <span className="text-right">Net</span>
                        <span />
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {sortedSnapshots.map((snap) => {
                          const isEditing = editingSnapshotId === snap.id;
                          const net = snap.assets - snap.liabilities;
                          return (
                            <div
                              key={snap.id}
                              className="grid grid-cols-[100px_1fr_1fr_1fr_36px] gap-2 items-center px-4 py-1.5 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              {isEditing ? (
                                <>
                                  <input
                                    type="date"
                                    onClick={(e) => {
                                      try {
                                        e.currentTarget.showPicker();
                                      } catch (err) { }
                                    }}
                                    value={editingSnapshot.date}
                                    onChange={(e) => setEditingSnapshot((prev) => ({ ...prev, date: e.target.value }))}
                                    className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                  <input
                                    type="number"
                                    value={editingSnapshot.assets}
                                    onChange={(e) => setEditingSnapshot((prev) => ({ ...prev, assets: e.target.value }))}
                                    className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-right text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                  <input
                                    type="number"
                                    value={editingSnapshot.liabilities}
                                    onChange={(e) => setEditingSnapshot((prev) => ({ ...prev, liabilities: e.target.value }))}
                                    className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs text-right text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                  <span className="text-xs text-right font-medium tabular-nums text-slate-400">—</span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={saveEditingSnapshot}
                                      className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-500 transition-colors"
                                      title="Save"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingSnapshot}
                                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 transition-colors"
                                      title="Cancel"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">{snap.date}</span>
                                  <span className="text-xs text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                                    {formatAmount(snap.assets)}
                                  </span>
                                  <span className="text-xs text-right font-medium tabular-nums text-rose-600 dark:text-rose-400">
                                    {formatAmount(snap.liabilities)}
                                  </span>
                                  <span className={`text-xs text-right font-semibold tabular-nums ${net >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {formatAmount(net)}
                                  </span>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => startEditingSnapshot(snap)}
                                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                      title="Edit"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteSnapshot(snap.id)}
                                      className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-colors"
                                      title="Delete"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Snapshot Form */}
                <div className="p-4 pt-3 flex-1 flex flex-col justify-end border-t border-slate-100 dark:border-slate-700/50">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">Log Snapshot</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) { }
                      }}
                      value={snapshotDate}
                      onChange={(e) => setSnapshotDate(e.target.value)}
                      className="flex-1 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-slate-300 dark:focus:border-slate-500 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none transition-colors"
                    />
                    <input
                      type="number"
                      value={snapshotAssets}
                      onChange={(e) => setSnapshotAssets(e.target.value)}
                      placeholder="Assets"
                      className="w-24 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-slate-300 dark:focus:border-slate-500 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none transition-colors"
                    />
                    <input
                      type="number"
                      value={snapshotLiabilities}
                      onChange={(e) => setSnapshotLiabilities(e.target.value)}
                      placeholder="Liabilities"
                      className="w-24 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-slate-300 dark:focus:border-slate-500 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddNetWorthSnapshot}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </section>

              {/* ─── Subscriptions Card ─── */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 flex flex-col">
                <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subscriptions</h3>
                    <button
                      type="button"
                      onClick={() => setShowAddSubscription(!showAddSubscription)}
                      className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Add subscription"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  {/* Inline Add Form */}
                  {showAddSubscription && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={subscriptionName}
                          onChange={(e) => setSubscriptionName(e.target.value)}
                          placeholder="Service name"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600"
                          autoFocus
                        />
                        <input
                          type="number"
                          value={subscriptionCost}
                          onChange={(e) => setSubscriptionCost(e.target.value)}
                          placeholder="Cost"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={subscriptionPaymentMethod}
                          onChange={(e) => setSubscriptionPaymentMethod(e.target.value)}
                          placeholder="Payment (e.g. WF Card)"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600"
                        />
                        <input
                          value={subscriptionDueDate}
                          onChange={(e) => setSubscriptionDueDate(e.target.value)}
                          placeholder="Due Date (e.g. 5th)"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={subscriptionBilling}
                          onChange={(e) => setSubscriptionBilling(e.target.value as 'monthly' | 'yearly')}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                        <select
                          value={subscriptionCategory}
                          onChange={(e) => setSubscriptionCategory(e.target.value as SubscriptionCategory)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600"
                        >
                          {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddSubscription(false)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddSubscription}
                          disabled={!subscriptionName.trim() || !subscriptionCost}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Service List Table */}
                <div className="flex-1 overflow-y-auto">
                  {subscriptions.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500">No subscriptions tracked yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {/* Table Header */}
                      <div className="grid grid-cols-[auto_1fr_60px_80px_60px_40px] gap-3 items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 sticky top-0 bg-white dark:bg-slate-800/70 z-10">
                        <span className="w-1" />
                        <span>Service</span>
                        <span className="text-center">Due</span>
                        <span className="text-right">Cost</span>
                        <span className="text-center">Cycle</span>
                        <span />
                      </div>
                      {/* Table Rows */}
                      {[...subscriptions]
                        .sort((a, b) => {
                          const getNum = (str?: string) => {
                            if (!str) return 999;
                            const match = str.match(/\d+/);
                            return match ? parseInt(match[0], 10) : 999;
                          };
                          const numA = getNum(a.dueDate);
                          const numB = getNum(b.dueDate);
                          if (numA === numB) {
                            return a.name.localeCompare(b.name);
                          }
                          return numA - numB;
                        })
                        .map((item) => (
                          <div
                            key={item.id}
                            className={`grid grid-cols-[auto_1fr_60px_80px_60px_40px] gap-3 items-center px-4 py-2 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!item.active ? 'opacity-50' : ''
                              }`}
                          >
                            {/* Category Color Strip */}
                            <div className={`w-1 h-6 rounded-full ${CATEGORY_COLORS[item.category]}`} title={CATEGORY_LABELS[item.category]} />
                            {/* Name and Payment Method */}
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm font-medium truncate ${item.active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 line-through'}`}>
                                {item.name}
                              </span>
                              {item.paymentMethod && (
                                <div className="relative group/info flex-shrink-0">
                                  <svg className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/info:block w-max max-w-[150px] p-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded shadow-lg z-20 whitespace-normal text-center">
                                    {item.paymentMethod}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800 dark:border-t-slate-700"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Due Date */}
                            <span className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                              {item.dueDate || '-'}
                            </span>
                            {/* Cost */}
                            <span className="text-sm text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                              {formatAmount(item.cost, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                            </span>
                            {/* Billing */}
                            <span className="text-[11px] text-center text-slate-400 dark:text-slate-500">
                              {item.billing === 'monthly' ? '/mo' : '/yr'}
                            </span>
                            {/* Action Icons */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => toggleSubscription(item.id)}
                                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title={item.active ? 'Pause' : 'Resume'}
                              >
                                {item.active ? (
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSubscription(item.id)}
                                className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Total Monthly Burn Footer */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Monthly Burn</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatAmount(monthlySubscriptionTotal)}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">/mo</span>
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          <div className="flex-1 min-h-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
                {COLUMNS.map(col => (
                  <Column
                    key={col.status}
                    status={col.status}
                    label={col.label}
                    color={col.color}
                    tasks={tasksByStatus[col.status]}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTask ? (
                  <div className="rotate-3">
                    <TaskCard task={activeTask} isDragging />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>
      
      {/* Modals placed here */}
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} />
    </div>
  );
}
