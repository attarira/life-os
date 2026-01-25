'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Task, TaskStatus, ROOT_TASK_ID, CreateTaskInput, UpdateTaskInput, COMPLETED_HIDE_DAYS } from './types';
import { taskStore } from './store';
import { createSeedTasks, getSubtreeIds, getNextOrder, isCompletedOlderThan } from './tasks';

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
    const updated = await taskStore.updateTask(id, updates);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  }, []);

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
    const updated = await taskStore.updateTask(taskId, updates);
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
  }, []);

  const reorderTasks = useCallback(async (taskIds: string[], status: TaskStatus): Promise<void> => {
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
