import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { MemoryNode } from './types';
import { generateId } from './utils';

const DB_NAME = 'lifeos-memory-db';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

interface MemoryDB extends DBSchema {
  memories: {
    key: string;
    value: MemoryNode;
    indexes: {
      'by-type': string;
      'by-lastAccessed': string;
    };
  };
}

class MemoryStore {
  private dbPromise: Promise<IDBPDatabase<MemoryDB>> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.dbPromise) return;

    this.dbPromise = openDB<MemoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-type', 'type');
          store.createIndex('by-lastAccessed', 'lastAccessedAt');
        }
      },
    });
  }

  private async getDB(): Promise<IDBPDatabase<MemoryDB>> {
    if (!this.dbPromise) {
      if (typeof window === 'undefined') {
        throw new Error('MemoryStore cannot be initialized on the server');
      }
      this.init();
    }
    return this.dbPromise!;
  }

  async getAll(): Promise<MemoryNode[]> {
    try {
      const db = await this.getDB();
      return db.getAll(STORE_NAME);
    } catch (e) {
      return [];
    }
  }

  async get(id: string): Promise<MemoryNode | undefined> {
    try {
      const db = await this.getDB();
      return db.get(STORE_NAME, id);
    } catch {
      return undefined;
    }
  }

  async getByType(type: MemoryNode['type']): Promise<MemoryNode[]> {
    try {
      const db = await this.getDB();
      return db.getAllFromIndex(STORE_NAME, 'by-type', type);
    } catch {
      return [];
    }
  }

  async add(memory: Omit<MemoryNode, 'id' | 'timestamp' | 'lastAccessedAt' | 'accessCount'>): Promise<MemoryNode> {
    const db = await this.getDB();
    const now = new Date().toISOString();

    const node: MemoryNode = {
      ...memory,
      id: generateId(),
      timestamp: now,
      lastAccessedAt: now,
      accessCount: 1,
    };

    await db.add(STORE_NAME, node);
    return node;
  }

  async update(id: string, updates: Partial<MemoryNode>): Promise<MemoryNode> {
    const db = await this.getDB();
    const existing = await db.get(STORE_NAME, id);
    if (!existing) {
      throw new Error(`MemoryNode with id ${id} not found.`);
    }

    const updated = { ...existing, ...updates };
    await db.put(STORE_NAME, updated);
    return updated;
  }

  async touch(id: string): Promise<void> {
    const db = await this.getDB();
    const existing = await db.get(STORE_NAME, id);
    if (!existing) return;

    existing.accessCount += 1;
    existing.lastAccessedAt = new Date().toISOString();
    await db.put(STORE_NAME, existing);
  }

  async remove(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(STORE_NAME, id);
  }
}

export const memoryStore = new MemoryStore();
