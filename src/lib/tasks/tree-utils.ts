import { Task, ROOT_TASK_ID } from '../types';

/**
 * Get the path from root to a task (array of ancestor tasks)
 */
export function getTaskPath(tasks: Task[], taskId: string): Task[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const path: Task[] = [];

  let currentId: string | undefined = taskId;
  while (currentId && currentId !== ROOT_TASK_ID) {
    const task = taskMap.get(currentId);
    if (!task) break;
    path.unshift(task);
    currentId = task.parentId;
  }

  return path;
}

/**
 * Format a path as a breadcrumb string
 */
export function formatBreadcrumb(path: Task[], maxLength = 50): string {
  if (path.length === 0) return 'Root';

  const titles = ['Root', ...path.map(t => t.title)];
  const fullPath = titles.join(' › ');

  if (fullPath.length <= maxLength) return fullPath;

  // Truncate middle if too long
  if (titles.length <= 2) {
    return fullPath.slice(0, maxLength - 3) + '...';
  }

  const first = titles[0];
  const last = titles[titles.length - 1];
  return `${first} › ... › ${last}`;
}

/**
 * Check if setting newParentId as a task's parent would create a cycle
 */
export function wouldCreateCycle(
  tasks: Task[],
  taskId: string,
  newParentId: string
): boolean {
  if (newParentId === ROOT_TASK_ID) return false;
  if (newParentId === taskId) return true;

  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // Check if newParentId is a descendant of taskId
  let currentId: string | undefined = newParentId;
  while (currentId && currentId !== ROOT_TASK_ID) {
    if (currentId === taskId) return true;
    const task = taskMap.get(currentId);
    if (!task) break;
    currentId = task.parentId;
  }

  return false;
}

/**
 * Get all descendant task IDs (for subtree deletion)
 */
export function getSubtreeIds(tasks: Task[], taskId: string): string[] {
  const ids: string[] = [taskId];
  const childrenMap = new Map<string, Task[]>();

  // Build children map
  for (const task of tasks) {
    const children = childrenMap.get(task.parentId) || [];
    children.push(task);
    childrenMap.set(task.parentId, children);
  }

  // BFS to collect all descendants
  const queue = [taskId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenMap.get(currentId) || [];
    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }

  return ids;
}

/**
 * Get the next order value for a task in a given parent/status
 */
export function getNextOrder(tasks: Task[], parentId: string, status: string): number {
  const siblings = tasks.filter(t => t.parentId === parentId && t.status === status);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map(t => t.order)) + 1;
}

/**
 * Check if a task's completedAt is older than given days
 */
export function isCompletedOlderThan(task: Task, days: number): boolean {
  if (!task.completedAt) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(task.completedAt) < cutoff;
}

/**
 * Get relative time string for completed tasks
 */
export function getCompletedAgoText(task: Task): string {
  if (!task.completedAt) return '';

  const now = new Date();
  const completed = new Date(task.completedAt);
  const diffMs = now.getTime() - completed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `Completed ${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    return `Completed ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }

  return `Completed ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

/**
 * Check if a task is overdue
 */
export function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'COMPLETED') return false;
  return new Date(task.dueDate) < new Date();
}

/**
 * Validate task title
 */
export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) {
    return 'Title is required';
  }
  if (trimmed.length > 200) {
    return 'Title must be 200 characters or less';
  }
  return null;
}
