import { Task, ROOT_TASK_ID, LIFE_AREAS, TaskPriority } from '../types';

export function createSeedTasks(): Task[] {
  const now = new Date();
  const tasks: Task[] = [];

  // Create Life Area roots
  LIFE_AREAS.forEach((area, index) => {
    tasks.push({
      id: area.id,
      parentId: ROOT_TASK_ID,
      title: area.title,
      description: area.description,
      status: 'NOT_STARTED', // Roots don't really have status, but type requires it
      priority: 'MEDIUM',
      createdAt: now,
      updatedAt: now,
      order: index,
      tags: ['root'],
    });
  });

  // Helper to add tasks to an area
  const addTask = (
    id: string,
    parentId: string,
    title: string,
    status: Task['status'],
    order: number,
    priority: TaskPriority = 'MEDIUM'
  ) => {
    tasks.push({
      id,
      parentId,
      title,
      status,
      priority,
      createdAt: now,
      updatedAt: now,
      order,
    });
  };

  // Career Tasks
  addTask('c1', 'career', 'Complete Q1 Review', 'IN_PROGRESS', 0, 'HIGH');
  addTask('c2', 'career', 'Update Resume', 'NOT_STARTED', 1, 'MEDIUM');

  // Health Tasks
  addTask('h1', 'health', 'Morning Run', 'COMPLETED', 0, 'MEDIUM');
  addTask('h2', 'health', 'Meal Prep', 'NOT_STARTED', 1, 'HIGH');

  // Finances
  addTask('f1', 'finances', 'Budget Review', 'ON_HOLD', 0, 'HIGH');

  return tasks;
}
