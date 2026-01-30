import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Task, TaskStore, CreateTaskInput, UpdateTaskInput, ROOT_TASK_ID } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'kanban-tasks-db';
const DB_VERSION = 1;
const TASKS_STORE = 'tasks';
const META_STORE = 'meta';

interface KanbanDB extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: { 'by-parent': string; 'by-status': string };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbInstance: IDBPDatabase<KanbanDB> | null = null;

async function getDB(): Promise<IDBPDatabase<KanbanDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<KanbanDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create tasks store
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        const taskStore = db.createObjectStore(TASKS_STORE, { keyPath: 'id' });
        taskStore.createIndex('by-parent', 'parentId');
        taskStore.createIndex('by-status', 'status');
      }
      // Create meta store for app state
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// Helper to serialize dates for storage
function serializeTask(task: Task): Task {
  return {
    ...task,
    createdAt: task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt),
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt : new Date(task.updatedAt),
    completedAt: task.completedAt instanceof Date ? task.completedAt :
      task.completedAt ? new Date(task.completedAt) : undefined,
    dueDate: task.dueDate instanceof Date ? task.dueDate :
      task.dueDate ? new Date(task.dueDate) : undefined,
    scheduledDate: task.scheduledDate instanceof Date ? task.scheduledDate :
      task.scheduledDate ? new Date(task.scheduledDate) : undefined,
    calendarOnly: task.calendarOnly,
  };
}

// Helper to deserialize dates from storage
function deserializeTask(task: Task): Task {
  return {
    ...task,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    scheduledDate: task.scheduledDate ? new Date(task.scheduledDate) : undefined,
    calendarOnly: task.calendarOnly,
  };
}

export const indexedDBStore: TaskStore = {
  async getAllTasks(): Promise<Task[]> {
    const db = await getDB();
    const tasks = await db.getAll(TASKS_STORE);
    return tasks.map(deserializeTask);
  },

  async getTask(id: string): Promise<Task | undefined> {
    const db = await getDB();
    const task = await db.get(TASKS_STORE, id);
    return task ? deserializeTask(task) : undefined;
  },

  async getChildren(parentId: string): Promise<Task[]> {
    const db = await getDB();
    const tasks = await db.getAllFromIndex(TASKS_STORE, 'by-parent', parentId);
    return tasks.map(deserializeTask).sort((a, b) => a.order - b.order);
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const db = await getDB();
    const now = new Date();

    const task: Task = {
      ...input,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      completedAt: input.status === 'COMPLETED' ? now : undefined,
    };

    await db.put(TASKS_STORE, serializeTask(task));
    return task;
  },

  async updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    const db = await getDB();
    const existing = await db.get(TASKS_STORE, id);

    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const now = new Date();
    const wasCompleted = existing.status === 'COMPLETED';
    const isNowCompleted = updates.status === 'COMPLETED';

    const updated: Task = {
      ...deserializeTask(existing),
      ...updates,
      updatedAt: now,
      // Set completedAt when transitioning to COMPLETED
      completedAt: !wasCompleted && isNowCompleted ? now :
        wasCompleted && !isNowCompleted ? undefined :
          existing.completedAt,
    };

    await db.put(TASKS_STORE, serializeTask(updated));
    return updated;
  },

  async deleteTask(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(TASKS_STORE, id);
  },

  async deleteTasks(ids: string[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(TASKS_STORE, 'readwrite');
    await Promise.all(ids.map(id => tx.store.delete(id)));
    await tx.done;
  },

  async importTasks(tasks: Task[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(TASKS_STORE, 'readwrite');

    // Clear existing tasks
    await tx.store.clear();

    // Add all imported tasks
    for (const task of tasks) {
      await tx.store.put(serializeTask(task));
    }

    await tx.done;
  },

  async exportTasks(): Promise<Task[]> {
    return this.getAllTasks();
  },

  async isInitialized(): Promise<boolean> {
    const db = await getDB();
    const meta = await db.get(META_STORE, 'initialized');
    return meta?.value === true;
  },

  async setInitialized(): Promise<void> {
    const db = await getDB();
    await db.put(META_STORE, { key: 'initialized', value: true });
  },
};

export default indexedDBStore;
