import { Task } from '../types';

export type AssistantIntent = 'daily_focus' | 'status_summary' | 'task_lookup' | 'general_chat';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: AssistantIntent;
  recommendedTaskIds?: string[];
  recommendedAreaId?: string;
  debugReasoning?: string[];
};

export type AppContext = {
  tasks: Task[];
  navigateTo: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
};

export interface ActionableTaskCandidate {
  taskId: string;
  areaId: string;
  areaTitle: string;
  title: string;
  breadcrumb: string;
  status: Task['status'];
  priority: Task['priority'];
  dueDate?: Date;
  scheduledDate?: Date;
  score: number;
  reasons: string[];
}

export interface AssistantAreaSnapshot {
  areaId: string;
  areaTitle: string;
  actionableCount: number;
  activeCount: number;
  blockedCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
  topTaskId?: string;
  topTaskTitle?: string;
  topTaskScore?: number;
}

export interface CompletedTaskSummary {
  taskId: string;
  areaId: string;
  areaTitle: string;
  title: string;
  breadcrumb: string;
  completedAt?: Date;
}

export interface BlockedTaskSummary {
  taskId: string;
  areaId: string;
  areaTitle: string;
  title: string;
  breadcrumb: string;
}

export interface AssistantTaskSnapshot {
  areas: AssistantAreaSnapshot[];
  actionableTasks: ActionableTaskCandidate[];
  activeTasks: ActionableTaskCandidate[];
  blockedTasks: BlockedTaskSummary[];
  recentlyCompleted: CompletedTaskSummary[];
  archivedCompletedCount: number;
}

export interface DailyFocusRecommendation {
  kind: 'focused_task' | 'planning_fallback';
  areaId?: string;
  areaTitle?: string;
  primaryTaskId?: string;
  primaryTaskTitle?: string;
  primaryReason: string;
  alternateTaskIds: string[];
  alternateTaskTitles: string[];
  debugReasoning: string[];
}

export interface AssistantReply {
  text: string;
  intent: AssistantIntent;
  recommendedTaskIds?: string[];
  recommendedAreaId?: string;
  debugReasoning?: string[];
}

export type ChatAdapter = (
  message: string,
  history: ChatMessage[],
  context: AppContext
) => Promise<AssistantReply>;
