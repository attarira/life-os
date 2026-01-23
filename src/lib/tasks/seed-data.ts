import { Task, ROOT_TASK_ID, TaskStatus } from '../types';

export const SEED_TASKS: Omit<Task, 'createdAt' | 'updatedAt'>[] = [
  // Direct children of Root - "Life Areas"
  {
    id: 'job-search',
    parentId: ROOT_TASK_ID,
    title: 'Job Search',
    description: 'Active job hunting activities',
    status: 'IN_PROGRESS',
    order: 0,
  },
  {
    id: 'learning',
    parentId: ROOT_TASK_ID,
    title: 'Learning & Development',
    description: 'Courses, certifications, and skill building',
    status: 'IN_PROGRESS',
    order: 1,
  },
  {
    id: 'home-projects',
    parentId: ROOT_TASK_ID,
    title: 'Home Projects',
    description: 'Household tasks and improvements',
    status: 'NOT_STARTED',
    order: 2,
  },
  {
    id: 'completed-area',
    parentId: ROOT_TASK_ID,
    title: 'Previous Projects',
    description: 'Archived completed projects',
    status: 'COMPLETED',
    order: 3,
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },

  // Job Search children
  {
    id: 'networking',
    parentId: 'job-search',
    title: 'Networking',
    description: 'Reach out to contacts and attend events',
    status: 'IN_PROGRESS',
    order: 0,
  },
  {
    id: 'applications',
    parentId: 'job-search',
    title: 'Applications',
    description: 'Track and submit job applications',
    status: 'NOT_STARTED',
    order: 1,
  },
  {
    id: 'resume-update',
    parentId: 'job-search',
    title: 'Update Resume',
    description: 'Refresh resume with latest experience',
    status: 'COMPLETED',
    order: 2,
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
  },

  // Networking children
  {
    id: 'linkedin-outreach',
    parentId: 'networking',
    title: 'LinkedIn Outreach',
    description: 'Connect with industry professionals',
    status: 'IN_PROGRESS',
    order: 0,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
  },
  {
    id: 'coffee-chats',
    parentId: 'networking',
    title: 'Schedule Coffee Chats',
    description: 'Set up informal meetings',
    status: 'NOT_STARTED',
    order: 1,
  },
  {
    id: 'meetup-events',
    parentId: 'networking',
    title: 'Attend Tech Meetups',
    description: 'Find and attend local tech meetups',
    status: 'ON_HOLD',
    order: 2,
  },

  // Learning children
  {
    id: 'typescript-course',
    parentId: 'learning',
    title: 'TypeScript Deep Dive',
    description: 'Complete advanced TypeScript course',
    status: 'IN_PROGRESS',
    order: 0,
  },
  {
    id: 'react-patterns',
    parentId: 'learning',
    title: 'React Design Patterns',
    description: 'Study common React patterns and best practices',
    status: 'NOT_STARTED',
    order: 1,
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Overdue!
  },

  // Home Projects children
  {
    id: 'garage-cleanup',
    parentId: 'home-projects',
    title: 'Garage Cleanup',
    description: 'Organize and declutter the garage',
    status: 'NOT_STARTED',
    order: 0,
  },
  {
    id: 'garden-planning',
    parentId: 'home-projects',
    title: 'Garden Planning',
    description: 'Plan spring garden layout',
    status: 'NOT_STARTED',
    order: 1,
  },

  // An old completed task (should be hidden by auto-hide)
  {
    id: 'old-completed',
    parentId: ROOT_TASK_ID,
    title: 'Old Completed Task',
    description: 'This should be in the archive (older than 7 days)',
    status: 'COMPLETED',
    order: 4,
    completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  },
];

export function createSeedTasks(): Task[] {
  const now = new Date();
  return SEED_TASKS.map(task => ({
    ...task,
    createdAt: task.completedAt ? new Date(new Date(task.completedAt).getTime() - 24 * 60 * 60 * 1000) : now,
    updatedAt: task.completedAt ? new Date(task.completedAt) : now,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
  }));
}
