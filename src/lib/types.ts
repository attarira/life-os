// Task status enum
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";

// Core Task interface
export interface Task {
  id: string;
  parentId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  order: number;
  dueDate?: Date;
  tags?: string[];
}

// Task creation input (without auto-generated fields)
export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

// Task update input (partial fields)
export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt'>>;

// TaskStore interface for persistence abstraction
export interface TaskStore {
  getAllTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  getChildren(parentId: string): Promise<Task[]>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, updates: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  deleteTasks(ids: string[]): Promise<void>;
  importTasks(tasks: Task[]): Promise<void>;
  exportTasks(): Promise<Task[]>;
  isInitialized(): Promise<boolean>;
  setInitialized(): Promise<void>;
}

// Root task constant
export const ROOT_TASK_ID = "root";

// Column configuration
export const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "NOT_STARTED", label: "Not Started", color: "bg-slate-500" },
  { status: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500" },
  { status: "ON_HOLD", label: "On Hold", color: "bg-amber-500" },
  { status: "COMPLETED", label: "Completed", color: "bg-green-500" },
];

// Days after which completed tasks are hidden
export const COMPLETED_HIDE_DAYS = 7;
