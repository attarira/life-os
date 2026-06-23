import { Task, TaskStore, CreateTaskInput, UpdateTaskInput, TaskStatus, TaskPriority, TaskRecurrence } from '../types';
import { getSupabase } from '../supabase/client';

const TABLE = 'tasks';

// Shape of a row in public.tasks (snake_case, dates as ISO strings).
type TaskRow = {
  id: string;
  parent_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sort_order: number;
  due_date: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  calendar_only: boolean;
  tags: string[] | null;
  frequency: string | null;
  recurrence: TaskRecurrence | null;
  is_leaf: boolean | null;
  created_at: string;
  updated_at: string;
};

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    order: row.sort_order,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    scheduledDate: row.scheduled_date ? new Date(row.scheduled_date) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    calendarOnly: row.calendar_only ?? undefined,
    tags: row.tags ?? undefined,
    frequency: row.frequency ?? undefined,
    recurrence: row.recurrence ?? undefined,
    isLeaf: row.is_leaf ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Maps a Task (or partial) to a row payload. Only defined keys are included so
// partial updates don't clobber columns. user_id is filled by the DB default
// (auth.uid()), so it is never sent from the client.
function taskToRow(task: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (task.id !== undefined) row.id = task.id;
  if (task.parentId !== undefined) row.parent_id = task.parentId;
  if (task.title !== undefined) row.title = task.title;
  if (task.description !== undefined) row.description = task.description ?? null;
  if (task.status !== undefined) row.status = task.status;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.order !== undefined) row.sort_order = task.order;
  if (task.dueDate !== undefined) row.due_date = task.dueDate ? new Date(task.dueDate).toISOString() : null;
  if (task.scheduledDate !== undefined) row.scheduled_date = task.scheduledDate ? new Date(task.scheduledDate).toISOString() : null;
  if (task.completedAt !== undefined) row.completed_at = task.completedAt ? new Date(task.completedAt).toISOString() : null;
  if (task.calendarOnly !== undefined) row.calendar_only = task.calendarOnly ?? false;
  if (task.tags !== undefined) row.tags = task.tags ?? null;
  if (task.frequency !== undefined) row.frequency = task.frequency ?? null;
  if (task.recurrence !== undefined) row.recurrence = task.recurrence ?? null;
  if (task.isLeaf !== undefined) row.is_leaf = task.isLeaf ?? null;
  if (task.createdAt !== undefined) row.created_at = new Date(task.createdAt).toISOString();
  if (task.updatedAt !== undefined) row.updated_at = new Date(task.updatedAt).toISOString();
  return row;
}

const INITIALIZED_KEY = 'tasks_initialized';

export const supabaseTaskStore: TaskStore = {
  async getAllTasks(): Promise<Task[]> {
    const { data, error } = await getSupabase().from(TABLE).select('*');
    if (error) throw error;
    return (data as TaskRow[]).map(rowToTask);
  },

  async getTask(id: string): Promise<Task | undefined> {
    const { data, error } = await getSupabase().from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToTask(data as TaskRow) : undefined;
  },

  async getChildren(parentId: string): Promise<Task[]> {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data as TaskRow[]).map(rowToTask);
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const payload = taskToRow({
      ...input,
      completedAt: input.status === 'COMPLETED' ? new Date() : undefined,
    });
    const { data, error } = await getSupabase().from(TABLE).insert(payload).select('*').single();
    if (error) throw error;
    return rowToTask(data as TaskRow);
  },

  async updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    const supabase = getSupabase();

    // Replicate the completedAt transition logic from the IndexedDB store.
    const patch: Partial<Task> = { ...updates };
    if (updates.status !== undefined) {
      const { data: existing, error: readErr } = await supabase
        .from(TABLE).select('status, completed_at').eq('id', id).single();
      if (readErr) throw readErr;
      const wasCompleted = (existing as { status: TaskStatus }).status === 'COMPLETED';
      const isNowCompleted = updates.status === 'COMPLETED';
      if (!wasCompleted && isNowCompleted) patch.completedAt = new Date();
      else if (wasCompleted && !isNowCompleted) patch.completedAt = undefined;
    }

    const { data, error } = await supabase
      .from(TABLE).update(taskToRow(patch)).eq('id', id).select('*').single();
    if (error) throw error;
    return rowToTask(data as TaskRow);
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await getSupabase().from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  async deleteTasks(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await getSupabase().from(TABLE).delete().in('id', ids);
    if (error) throw error;
  },

  async importTasks(tasks: Task[]): Promise<void> {
    const supabase = getSupabase();
    // Clear the user's existing tasks (RLS limits this to the current user).
    const { error: delErr } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) throw delErr;
    if (tasks.length === 0) return;
    const { error } = await supabase.from(TABLE).insert(tasks.map((t) => taskToRow(t)));
    if (error) throw error;
  },

  async exportTasks(): Promise<Task[]> {
    return this.getAllTasks();
  },

  async isInitialized(): Promise<boolean> {
    const { data, error } = await getSupabase()
      .from('user_settings').select('value').eq('key', INITIALIZED_KEY).maybeSingle();
    if (error) throw error;
    return data?.value === true;
  },

  async setInitialized(): Promise<void> {
    const { error } = await getSupabase()
      .from('user_settings').upsert({ key: INITIALIZED_KEY, value: true }, { onConflict: 'user_id,key' });
    if (error) throw error;
  },
};

export default supabaseTaskStore;
