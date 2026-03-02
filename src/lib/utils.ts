import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function resolveAreaKey(id: string): string {
  const key = id.toLowerCase();
  if (key.includes('home')) return 'home';
  if (key.includes('health') || key.includes('well')) return 'health';
  if (key.includes('finance') || key.includes('budget')) return 'finances';
  if (key.includes('relation') || key.includes('family') || key.includes('social')) return 'relationships';
  if (key.includes('career') || key.includes('work') || key.includes('job')) return 'career';
  if (key.includes('grow') || key.includes('learn') || key.includes('personal')) return 'growth';
  if (key.includes('recre') || key.includes('play') || key.includes('fun')) return 'recreation';
  return id;
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (error) {
      console.warn(`Failed to read from localStorage key "${key}":`, error);
    }
    return fallback;
  },
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to write to localStorage key "${key}":`, error);
    }
  },
};
