'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Task, TaskStatus, ROOT_TASK_ID, CreateTaskInput, UpdateTaskInput, COMPLETED_HIDE_DAYS } from './types';
import { taskStore } from './store';
import { createSeedTasks, getSubtreeIds, getNextOrder, isCompletedOlderThan } from './tasks';
import { AUTO_BACKUP_KEY, DASHBOARD_PAGES_STORAGE_KEY, LAST_BACKUP_KEY } from './storage-keys';
import { storage, generateId } from '@/lib/utils';

interface TaskContextValue {
  // State
  tasks: Task[];
  currentParentId: string;
  isLoading: boolean;
  selectedTaskId: string | null;
  searchOpen: boolean;
  archiveOpen: boolean;

  // Navigation
  navigateTo: (taskId: string) => void;

  // Task selection
  selectTask: (taskId: string | null) => void;

  // CRUD operations
  createTask: (input: Omit<CreateTaskInput, 'order'>) => Promise<Task>;
  updateTask: (id: string, updates: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;

  // Drag and drop
  moveTask: (taskId: string, newStatus: TaskStatus, newOrder: number, newParentId?: string) => Promise<void>;
  reorderTasks: (taskIds: string[], status: TaskStatus) => Promise<void>;

  // Search and archive modals
  setSearchOpen: (open: boolean) => void;
  setArchiveOpen: (open: boolean) => void;

  // Import/Export
  importTasks: (tasks: Task[]) => Promise<void>;
  exportTasks: () => Promise<Task[]>;

  // Helpers
  getVisibleChildren: () => Task[];
  getArchivedTasks: () => Task[];
  searchTasks: (query: string) => Task[];
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}

interface TaskProviderProps {
  children: ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string>(ROOT_TASK_ID);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const BACKUP_RETENTION_DAYS = 30;

  // Initialize on mount
  useEffect(() => {
    async function init() {
      try {
        const initialized = await taskStore.isInitialized();
        if (!initialized) {
          // Seed with initial data
          const seedTasks = createSeedTasks();
          await taskStore.importTasks(seedTasks);
          await taskStore.setInitialized();
        }
        const allTasks = await taskStore.getAllTasks();
        setTasks(allTasks);
      } catch (error) {
        console.error('Failed to initialize tasks:', error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    try {
      const todayKey = new Date().toISOString().split('T')[0];
      const lastBackup = storage.get(LAST_BACKUP_KEY, '');
      const existing = storage.get<any[]>(AUTO_BACKUP_KEY, []);
      const hasTodayBackupWithNotes = Array.isArray(existing) && existing.some((entry: { createdAt?: string; notesPages?: unknown }) => (
        typeof entry?.createdAt === 'string' &&
        entry.createdAt.split('T')[0] === todayKey &&
        Array.isArray(entry.notesPages)
      ));
      if (lastBackup === todayKey && hasTodayBackupWithNotes) return;

      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);
      const retained = Array.isArray(existing)
        ? existing.filter((entry: { createdAt?: string }) => {
          if (!entry?.createdAt) return false;
          return new Date(entry.createdAt) >= cutoff && entry.createdAt.split('T')[0] !== todayKey;
        })
        : [];

      const notesParsed = storage.get<any[]>(DASHBOARD_PAGES_STORAGE_KEY, []);
      const notesPages = Array.isArray(notesParsed) ? notesParsed : [];

      const plannerItemsParsed = storage.get<any[]>('lifeos:planner-items:v1', []);
      const plannerItems = Array.isArray(plannerItemsParsed) ? plannerItemsParsed : [];

      const netWorthParsed = storage.get<any[]>('lifeos:finance:netWorth:v1', []);
      const netWorthSnapshots = Array.isArray(netWorthParsed) ? netWorthParsed : [];

      const subsParsed = storage.get<any[]>('lifeos:finance:subscriptions:v1', []);
      const subscriptions = Array.isArray(subsParsed) ? subsParsed : [];

      const notificationsParsed = storage.get<any[]>('lifeos:notifications:v1', []);
      const notifications = Array.isArray(notificationsParsed) ? notificationsParsed : [];

      const currency = storage.get<string>('lifeos:currency', 'USD');

      const id = generateId();

      const next = [
        ...retained,
        {
          id,
          createdAt: now.toISOString(),
          tasks,
          notesPages,
          plannerItems,
          netWorthSnapshots,
          notifications,
          currency,
        },
      ];
      storage.set(AUTO_BACKUP_KEY, next);
      storage.set(LAST_BACKUP_KEY, todayKey);
    } catch (error) {
      console.warn('Auto-backup failed:', error);
    }
  }, [tasks, isLoading]);

  const navigateTo = useCallback((taskId: string) => {
    setCurrentParentId(taskId);
    setSelectedTaskId(null);
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
  }, []);

  const createTask = useCallback(async (input: Omit<CreateTaskInput, 'order'>): Promise<Task> => {
    const order = getNextOrder(tasks, input.parentId, input.status);
    const newTask = await taskStore.createTask({ ...input, order });
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [tasks]);

  const updateTask = useCallback(async (id: string, updates: UpdateTaskInput): Promise<Task> => {
    if (updates.status === 'COMPLETED') {
      const subtreeIds = getSubtreeIds(tasks, id);
      const descendants = subtreeIds.filter(taskId => taskId !== id);
      const [updatedRoot, ...updatedDescendants] = await Promise.all([
        taskStore.updateTask(id, updates),
        ...descendants.map(taskId => taskStore.updateTask(taskId, { status: 'COMPLETED' })),
      ]);
      const updatedMap = new Map([updatedRoot, ...updatedDescendants].map(task => [task.id, task]));
      setTasks(prev => prev.map(task => updatedMap.get(task.id) || task));
      return updatedRoot;
    }

    const updated = await taskStore.updateTask(id, updates);
    setTasks(prev => prev.map(task => task.id === id ? updated : task));
    return updated;
  }, [tasks]);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    const idsToDelete = getSubtreeIds(tasks, id);
    await taskStore.deleteTasks(idsToDelete);
    setTasks(prev => prev.filter(t => !idsToDelete.includes(t.id)));
    if (selectedTaskId && idsToDelete.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }
    // If we're viewing a deleted task, go back to root
    if (idsToDelete.includes(currentParentId)) {
      setCurrentParentId(ROOT_TASK_ID);
    }
  }, [tasks, selectedTaskId, currentParentId]);

  const moveTask = useCallback(async (taskId: string, newStatus: TaskStatus, newOrder: number, newParentId?: string): Promise<void> => {
    const updates: UpdateTaskInput = { status: newStatus, order: newOrder };
    if (newParentId) {
      updates.parentId = newParentId;
    }

    if (newStatus === 'COMPLETED') {
      const subtreeIds = getSubtreeIds(tasks, taskId);
      const descendants = subtreeIds.filter(id => id !== taskId);
      const [updatedRoot, ...updatedDescendants] = await Promise.all([
        taskStore.updateTask(taskId, updates),
        ...descendants.map(id => taskStore.updateTask(id, { status: 'COMPLETED' })),
      ]);
      const updatedMap = new Map([updatedRoot, ...updatedDescendants].map(task => [task.id, task]));
      setTasks(prev => prev.map(task => updatedMap.get(task.id) || task));
      return;
    }

    const updated = await taskStore.updateTask(taskId, updates);
    setTasks(prev => prev.map(task => task.id === taskId ? updated : task));
  }, [tasks]);

  const reorderTasks = useCallback(async (taskIds: string[], _status: TaskStatus): Promise<void> => {
    void _status;
    const updates = taskIds.map((id, index) =>
      taskStore.updateTask(id, { order: index })
    );
    const updatedTasks = await Promise.all(updates);
    setTasks(prev => {
      const taskMap = new Map(updatedTasks.map(t => [t.id, t]));
      return prev.map(t => taskMap.get(t.id) || t);
    });
  }, []);

  const importTasksHandler = useCallback(async (importedTasks: Task[]): Promise<void> => {
    await taskStore.importTasks(importedTasks);
    await taskStore.setInitialized();
    setTasks(importedTasks);
    setCurrentParentId(ROOT_TASK_ID);
    setSelectedTaskId(null);
  }, []);

  const exportTasksHandler = useCallback(async (): Promise<Task[]> => {
    return taskStore.exportTasks();
  }, []);

  const getVisibleChildren = useCallback((): Task[] => {
    return tasks
      .filter(t => t.parentId === currentParentId)
      .filter(t => !t.calendarOnly)
      .filter(t => {
        // Hide completed tasks older than 7 days
        if (t.status === 'COMPLETED' && isCompletedOlderThan(t, COMPLETED_HIDE_DAYS)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [tasks, currentParentId]);

  const getArchivedTasks = useCallback((): Task[] => {
    return tasks
      .filter(t => t.status === 'COMPLETED' && isCompletedOlderThan(t, COMPLETED_HIDE_DAYS))
      .sort((a, b) => {
        const aDate = new Date(b.completedAt!).getTime();
        const bDate = new Date(a.completedAt!).getTime();
        return aDate - bDate;
      });
  }, [tasks]);

  const searchTasks = useCallback((query: string): Task[] => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];

    return tasks.filter(t =>
      t.title.toLowerCase().includes(lowerQuery) ||
      (t.description && t.description.toLowerCase().includes(lowerQuery))
    );
  }, [tasks]);

  const value: TaskContextValue = {
    tasks,
    currentParentId,
    isLoading,
    selectedTaskId,
    searchOpen,
    archiveOpen,
    navigateTo,
    selectTask,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
    setSearchOpen,
    setArchiveOpen,
    importTasks: importTasksHandler,
    exportTasks: exportTasksHandler,
    getVisibleChildren,
    getArchivedTasks,
    searchTasks,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}
