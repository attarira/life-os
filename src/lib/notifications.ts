import { Task, Notification } from './types';
import { LAST_DAILY_SUMMARY_KEY, LAST_WEEKLY_SUMMARY_KEY, NOTIFIED_DUE_TASKS_KEY } from './storage-keys';

function buildNotificationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function generateDailySummaryNotification(tasks: Task[]): Notification | null {
  const todayKey = new Date().toISOString().split('T')[0];
  const lastSummary = typeof window !== 'undefined' ? localStorage.getItem(LAST_DAILY_SUMMARY_KEY) : null;

  if (lastSummary === todayKey) return null; // Already generated

  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_DAILY_SUMMARY_KEY, todayKey);
  }

  // Calculate simple stats for today
  const completedToday = tasks.filter(t => t.status === 'COMPLETED' && t.completedAt && (t.completedAt instanceof Date ? t.completedAt.toISOString() : new Date(t.completedAt).toISOString()).startsWith(todayKey)).length;

  if (completedToday === 0) {
    // Don't send a summary if they did nothing today
    const isEvening = new Date().getHours() >= 17;
    if (!isEvening) return null; // Wait until evening to say anything maybe? Actually let's just send it if it's past 5pm.
  }

  return {
    id: buildNotificationId(),
    type: 'DAILY_SUMMARY',
    title: 'Daily Summary',
    message: completedToday > 0
      ? `You completed ${completedToday} tasks today. Great work! Take a moment to review and plan tomorrow.`
      : `End of day reflection. Time to review your tasks and plan for tomorrow!`,
    read: false,
    createdAt: new Date(),
  };
}

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

export function generateWeeklySummaryNotification(tasks: Task[]): Notification | null {
  const weekKey = getWeekKey(new Date());
  const lastSummary = typeof window !== 'undefined' ? localStorage.getItem(LAST_WEEKLY_SUMMARY_KEY) : null;

  if (lastSummary === weekKey) return null;

  // Let's only trigger weekly summary on Friday-Sunday
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek >= 1 && dayOfWeek <= 4) return null; // Mon-Thu skip

  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_WEEKLY_SUMMARY_KEY, weekKey);
  }

  return {
    id: buildNotificationId(),
    type: 'WEEKLY_SUMMARY',
    title: 'Weekly Review',
    message: `It's time for your weekly review! Reflect on the past week and organize your upcoming goals.`,
    read: false,
    createdAt: new Date(),
  };
}

export function checkDueTasksForNotifications(tasks: Task[]): Notification[] {
  if (typeof window === 'undefined') return [];

  const rawNotified = localStorage.getItem(NOTIFIED_DUE_TASKS_KEY);
  const notifiedSet: Set<string> = rawNotified ? new Set(JSON.parse(rawNotified)) : new Set();

  const newNotifications: Notification[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const task of tasks) {
    if (task.status === 'COMPLETED') continue;
    if (!task.dueDate) continue;

    // Check if due is before or at today
    const taskDueDate = new Date(task.dueDate);
    if (taskDueDate.getTime() < startOfToday.getTime() + 24 * 60 * 60 * 1000) {
      // Due today or earlier
      if (!notifiedSet.has(task.id)) {
        notifiedSet.add(task.id);

        let message = `Task "${task.title}" is due today!`;
        if (taskDueDate.getTime() < startOfToday.getTime()) {
          message = `Task "${task.title}" is overdue!`;
        }

        newNotifications.push({
          id: buildNotificationId(),
          type: 'DUE_TASK',
          title: taskDueDate.getTime() < startOfToday.getTime() ? 'Overdue Task' : 'Task Due Today',
          message,
          read: false,
          createdAt: new Date(),
          relatedTaskId: task.id
        });
      }
    }
  }

  if (newNotifications.length > 0) {
    localStorage.setItem(NOTIFIED_DUE_TASKS_KEY, JSON.stringify(Array.from(notifiedSet)));
  }

  return newNotifications;
}
