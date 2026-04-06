import { LifeAreaDefinition, Task, ROOT_TASK_ID, LIFE_AREAS } from '../types';

export const LEGACY_SEEDED_TASK_IDS = [
  'c1',
  'c2',
  'h1',
  'h2',
  'f1',
  'health-workout',
  'health-shave',
  'health-haircut',
  'home-laundry',
  'home-groceries',
] as const;

export function createRootLifeAreaTask(area: LifeAreaDefinition, order: number, now = new Date()): Task {
  return {
    id: area.id,
    parentId: ROOT_TASK_ID,
    title: area.title,
    description: area.description,
    status: 'NOT_STARTED', // Roots don't really have status, but type requires it
    priority: 'MEDIUM',
    createdAt: now,
    updatedAt: now,
    order,
    tags: ['root'],
  };
}

export function createSeedTasks(): Task[] {
  const now = new Date();
  return LIFE_AREAS.map((area, index) => createRootLifeAreaTask(area, index, now));
}
