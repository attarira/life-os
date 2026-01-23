import { indexedDBStore } from './indexeddb-store';
import { TaskStore } from '../types';

// Export the store instance - can be swapped for different implementations
export const taskStore: TaskStore = indexedDBStore;

export * from './indexeddb-store';
