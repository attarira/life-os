import { COMPLETED_HIDE_DAYS, ROOT_TASK_ID, Task } from '../types';
import type {
  ActionableTaskCandidate,
  AssistantAreaSnapshot,
  AssistantIntent,
  AssistantReply,
  AssistantTaskSnapshot,
  AppContext,
  BlockedTaskSummary,
  CompletedTaskSummary,
  DailyFocusRecommendation,
} from './types';

const DAILY_FOCUS_PATTERNS = [
  /\bwhich task should i work on\b/,
  /\bwhat should i work on\b/,
  /\bwhat should i do today\b/,
  /\bwhat should i focus on\b/,
  /\btoday'?s focus\b/,
  /\bbest task\b/,
];

const STATUS_SUMMARY_PATTERNS = [
  /\bstatus\b/,
  /\bsummary\b/,
  /\bhow am i doing\b/,
  /\bwhat'?s on my plate\b/,
  /\boverview\b/,
];

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isRootAreaTask(task: Task): boolean {
  return task.parentId === ROOT_TASK_ID;
}

function getTaskMap(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map(task => [task.id, task]));
}

function getTaskPath(taskId: string, taskMap: Map<string, Task>): Task[] {
  const path: Task[] = [];
  let current = taskMap.get(taskId);

  while (current && current.id !== ROOT_TASK_ID) {
    path.unshift(current);
    current = taskMap.get(current.parentId);
  }

  return path;
}

function getRootArea(task: Task, taskMap: Map<string, Task>): Task | null {
  if (isRootAreaTask(task)) return task;

  const path = getTaskPath(task.id, taskMap);
  return path[0] || null;
}

function buildBreadcrumb(task: Task, taskMap: Map<string, Task>): string {
  return getTaskPath(task.id, taskMap)
    .map(node => node.title)
    .join(' > ');
}

function formatDateLabel(date?: Date): string | null {
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getDayDistance(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

export function getTaskRecommendationScoreBreakdown(task: Task, now = new Date()): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (task.status === 'IN_PROGRESS') {
    score += 32;
    reasons.push('already in progress');
  } else {
    score += 10;
  }

  switch (task.priority) {
    case 'HIGH':
      score += 14;
      reasons.push('high priority');
      break;
    case 'MEDIUM':
      score += 6;
      break;
    default:
      break;
  }

  if (task.dueDate) {
    const diffDays = getDayDistance(new Date(task.dueDate), now);
    if (diffDays < 0) {
      score += 40;
      reasons.push('overdue');
    } else if (diffDays <= 1) {
      score += 30;
      reasons.push('due today');
    } else if (diffDays <= 3) {
      score += 20;
      reasons.push('due soon');
    } else if (diffDays <= 7) {
      score += 12;
      reasons.push('due this week');
    }
  }

  if (task.scheduledDate) {
    const diffDays = getDayDistance(new Date(task.scheduledDate), now);
    if (diffDays < 0) {
      score += 12;
      reasons.push('scheduled time has already arrived');
    } else if (diffDays <= 1) {
      score += 14;
      reasons.push('scheduled for today');
    } else if (diffDays <= 3) {
      score += 8;
      reasons.push('scheduled soon');
    } else if (diffDays <= 7) {
      score += 4;
    }
  }

  const updatedAt = new Date(task.updatedAt || task.createdAt);
  const staleDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (task.status === 'IN_PROGRESS' && staleDays <= 2) {
    score += 8;
    reasons.push('it keeps current momentum');
  } else if (task.status === 'NOT_STARTED' && staleDays > 7) {
    score += 8;
    reasons.push('it has been waiting for attention');
  }

  if (task.isLeaf !== false) {
    score += 4;
  }

  return {
    score,
    reasons: Array.from(new Set(reasons)),
  };
}

export function scoreTaskForRecommendation(task: Task, now = new Date()): number {
  return getTaskRecommendationScoreBreakdown(task, now).score;
}

function buildActionableCandidates(tasks: Task[], now: Date, taskMap: Map<string, Task>): ActionableTaskCandidate[] {
  const openEligible = tasks.filter(task =>
    !task.calendarOnly &&
    !isRootAreaTask(task) &&
    (task.status === 'NOT_STARTED' || task.status === 'IN_PROGRESS')
  );

  const parentIdsWithOpenChildren = new Set(openEligible.map(task => task.parentId));
  const actionableTasks = openEligible.filter(task => !parentIdsWithOpenChildren.has(task.id));

  return actionableTasks
    .map((task): ActionableTaskCandidate | null => {
      const area = getRootArea(task, taskMap);
      if (!area) return null;

      const { score, reasons } = getTaskRecommendationScoreBreakdown(task, now);
      return {
        taskId: task.id,
        areaId: area.id,
        areaTitle: area.title,
        title: task.title,
        breadcrumb: buildBreadcrumb(task, taskMap),
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        scheduledDate: task.scheduledDate,
        score,
        reasons,
      };
    })
    .filter(isDefined)
    .sort((a, b) => b.score - a.score || a.breadcrumb.localeCompare(b.breadcrumb));
}

function buildBlockedTasks(tasks: Task[], taskMap: Map<string, Task>): BlockedTaskSummary[] {
  return tasks
    .filter(task => task.status === 'ON_HOLD' && !task.calendarOnly && !isRootAreaTask(task))
    .map((task): BlockedTaskSummary | null => {
      const area = getRootArea(task, taskMap);
      if (!area) return null;
      return {
        taskId: task.id,
        areaId: area.id,
        areaTitle: area.title,
        title: task.title,
        breadcrumb: buildBreadcrumb(task, taskMap),
      };
    })
    .filter(isDefined);
}

function buildCompletedTaskSummaries(tasks: Task[], now: Date, taskMap: Map<string, Task>): {
  recent: CompletedTaskSummary[];
  archivedCount: number;
} {
  const recent: CompletedTaskSummary[] = [];
  let archivedCount = 0;

  tasks
    .filter(task => task.status === 'COMPLETED' && !task.calendarOnly && !isRootAreaTask(task))
    .forEach(task => {
      const area = getRootArea(task, taskMap);
      if (!area) return;

      const completedAt = task.completedAt ? new Date(task.completedAt) : undefined;
      const summary: CompletedTaskSummary = {
        taskId: task.id,
        areaId: area.id,
        areaTitle: area.title,
        title: task.title,
        breadcrumb: buildBreadcrumb(task, taskMap),
        completedAt,
      };

      if (completedAt && getDayDistance(completedAt, now) >= -COMPLETED_HIDE_DAYS) {
        recent.push(summary);
      } else {
        archivedCount += 1;
      }
    });

  recent.sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  return { recent, archivedCount };
}

function buildAreaSnapshots(
  tasks: Task[],
  actionableTasks: ActionableTaskCandidate[],
  blockedTasks: BlockedTaskSummary[],
  now: Date
): AssistantAreaSnapshot[] {
  const rootAreas = tasks.filter(isRootAreaTask);

  return rootAreas.map(area => {
    const areaActionable = actionableTasks.filter(task => task.areaId === area.id);
    const areaBlocked = blockedTasks.filter(task => task.areaId === area.id);

    const overdueCount = areaActionable.filter(task => task.dueDate && new Date(task.dueDate) < now).length;
    const dueTodayCount = areaActionable.filter(task => {
      if (!task.dueDate) return false;
      const diffDays = getDayDistance(new Date(task.dueDate), now);
      return diffDays >= 0 && diffDays <= 1;
    }).length;
    const dueSoonCount = areaActionable.filter(task => {
      if (!task.dueDate) return false;
      const diffDays = getDayDistance(new Date(task.dueDate), now);
      return diffDays > 1 && diffDays <= 7;
    }).length;

    const topTask = areaActionable[0];

    return {
      areaId: area.id,
      areaTitle: area.title,
      actionableCount: areaActionable.length,
      activeCount: areaActionable.filter(task => task.status === 'IN_PROGRESS').length,
      blockedCount: areaBlocked.length,
      overdueCount,
      dueTodayCount,
      dueSoonCount,
      topTaskId: topTask?.taskId,
      topTaskTitle: topTask?.title,
      topTaskScore: topTask?.score,
    } satisfies AssistantAreaSnapshot;
  }).sort((a, b) => (b.topTaskScore || 0) - (a.topTaskScore || 0) || a.areaTitle.localeCompare(b.areaTitle));
}

export function buildAssistantTaskSnapshot(tasks: Task[], now = new Date()): AssistantTaskSnapshot {
  const taskMap = getTaskMap(tasks);
  const actionableTasks = buildActionableCandidates(tasks, now, taskMap);
  const blockedTasks = buildBlockedTasks(tasks, taskMap);
  const { recent, archivedCount } = buildCompletedTaskSummaries(tasks, now, taskMap);
  const areas = buildAreaSnapshots(tasks, actionableTasks, blockedTasks, now);

  return {
    areas,
    actionableTasks,
    activeTasks: actionableTasks.filter(task => task.status === 'IN_PROGRESS'),
    blockedTasks,
    recentlyCompleted: recent,
    archivedCompletedCount: archivedCount,
  };
}

function humanizeReasons(reasons: string[]): string {
  if (reasons.length === 0) return 'it is the strongest actionable option right now';
  if (reasons.length === 1) return `it is ${reasons[0]}`;
  if (reasons.length === 2) return `it is ${reasons[0]} and ${reasons[1]}`;
  return `it is ${reasons.slice(0, -1).join(', ')}, and ${reasons[reasons.length - 1]}`;
}

function buildAreaRanking(snapshot: AssistantTaskSnapshot): Array<AssistantAreaSnapshot & { score: number; reasoning: string[] }> {
  return snapshot.areas
    .filter(area => area.actionableCount > 0 && area.topTaskScore !== undefined)
    .map(area => {
      const reasoning: string[] = [];
      let score = area.topTaskScore || 0;

      if (area.overdueCount > 0) {
        score += area.overdueCount * 18;
        reasoning.push(`${area.overdueCount} overdue task${area.overdueCount === 1 ? '' : 's'}`);
      }
      if (area.dueTodayCount > 0) {
        score += area.dueTodayCount * 12;
        reasoning.push(`${area.dueTodayCount} task${area.dueTodayCount === 1 ? '' : 's'} due today`);
      }
      if (area.dueSoonCount > 0) {
        score += area.dueSoonCount * 6;
        reasoning.push(`${area.dueSoonCount} task${area.dueSoonCount === 1 ? '' : 's'} due this week`);
      }
      if (area.blockedCount > 0) {
        score += Math.min(area.blockedCount * 2, 6);
        reasoning.push(`${area.blockedCount} blocked task${area.blockedCount === 1 ? '' : 's'}`);
      }
      if (area.activeCount === 0 && (area.overdueCount > 0 || area.dueTodayCount > 0 || area.dueSoonCount > 0)) {
        score += 8;
        reasoning.push('urgent work with no active momentum');
      }
      if (area.activeCount > 0) {
        score += 4;
        reasoning.push('existing momentum');
      }

      return {
        ...area,
        score,
        reasoning,
      };
    })
    .sort((a, b) => b.score - a.score || a.areaTitle.localeCompare(b.areaTitle));
}

export function getTopTaskRecommendation(tasks: Task[], now = new Date()): Task | null {
  const snapshot = buildAssistantTaskSnapshot(tasks, now);
  const topCandidate = snapshot.actionableTasks[0];
  if (!topCandidate) return null;
  return tasks.find(task => task.id === topCandidate.taskId) || null;
}

export function recommendDailyFocus(tasks: Task[], now = new Date()): DailyFocusRecommendation {
  const snapshot = buildAssistantTaskSnapshot(tasks, now);
  const areaRanking = buildAreaRanking(snapshot);

  if (areaRanking.length === 0) {
    const blockedArea = [...snapshot.areas]
      .sort((a, b) => b.blockedCount - a.blockedCount || a.areaTitle.localeCompare(b.areaTitle))
      .find(area => area.blockedCount > 0);

    const debugReasoning = [
      'No actionable NOT_STARTED or IN_PROGRESS leaf tasks were available.',
      blockedArea
        ? `${blockedArea.areaTitle} has the highest blocked count (${blockedArea.blockedCount}).`
        : 'No blocked area stood out, so the safest fallback is a planning pass.',
    ];

    return {
      kind: 'planning_fallback',
      areaId: blockedArea?.areaId,
      areaTitle: blockedArea?.areaTitle,
      primaryReason: blockedArea
        ? `${blockedArea.areaTitle} is mostly blocked right now, so review that area and decide the next concrete step.`
        : 'Everything open is either completed, blocked, or too high-level, so start with a short planning pass.',
      alternateTaskIds: [],
      alternateTaskTitles: [],
      debugReasoning,
    };
  }

  const chosenArea = areaRanking[0];
  const areaTasks = snapshot.actionableTasks.filter(task => task.areaId === chosenArea.areaId);
  const primary = areaTasks[0];
  const alternates = areaTasks.slice(1, 3);

  return {
    kind: 'focused_task',
    areaId: chosenArea.areaId,
    areaTitle: chosenArea.areaTitle,
    primaryTaskId: primary.taskId,
    primaryTaskTitle: primary.title,
    primaryReason: humanizeReasons(primary.reasons.slice(0, 3)),
    alternateTaskIds: alternates.map(task => task.taskId),
    alternateTaskTitles: alternates.map(task => task.title),
    debugReasoning: [
      `Top area: ${chosenArea.areaTitle} (score ${chosenArea.score}).`,
      ...chosenArea.reasoning.map(reason => `${chosenArea.areaTitle}: ${reason}.`),
      `Top task: ${primary.breadcrumb} (score ${primary.score}).`,
      ...primary.reasons.map(reason => `${primary.title}: ${reason}.`),
    ],
  };
}

export function routeAssistantIntent(message: string): AssistantIntent {
  const lower = normalizeText(message);

  if (/^(go to|open|show)\s+/.test(lower)) {
    return 'task_lookup';
  }

  if (DAILY_FOCUS_PATTERNS.some(pattern => pattern.test(lower))) {
    return 'daily_focus';
  }

  if (STATUS_SUMMARY_PATTERNS.some(pattern => pattern.test(lower))) {
    return 'status_summary';
  }

  return 'general_chat';
}

function scoreTaskLookupMatch(task: Task, query: string): number {
  const title = task.title.toLowerCase();
  let score = 0;

  if (title === query) score += 100;
  if (title.startsWith(query)) score += 60;
  if (title.includes(query)) score += 30;
  if (isRootAreaTask(task)) score += 5;

  return score;
}

export function buildTaskLookupReply(message: string, context: AppContext): AssistantReply {
  const query = normalizeText(message).replace(/^(go to|open|show)\s+/i, '').trim();
  const ranked = context.tasks
    .map(task => ({ task, score: scoreTaskLookupMatch(task, query) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title));

  const match = ranked[0]?.task;

  if (!match) {
    return {
      intent: 'task_lookup',
      text: `I couldn't find a task or area matching "${query}".`,
    };
  }

  const taskMap = getTaskMap(context.tasks);
  const rootArea = getRootArea(match, taskMap);

  if (isRootAreaTask(match)) {
    context.navigateTo(match.id);
    context.selectTask(null);
  } else if (rootArea) {
    context.navigateTo(rootArea.id);
    context.selectTask(match.id);
  } else {
    context.selectTask(match.id);
  }

  return {
    intent: 'task_lookup',
    text: isRootAreaTask(match)
      ? `Opened **${match.title}**.`
      : `Opened **${match.title}** in **${rootArea?.title || 'its area'}**.`,
    recommendedTaskIds: isRootAreaTask(match) ? undefined : [match.id],
    recommendedAreaId: rootArea?.id || (isRootAreaTask(match) ? match.id : undefined),
  };
}

export function buildDailyFocusReply(tasks: Task[], now = new Date()): AssistantReply {
  const recommendation = recommendDailyFocus(tasks, now);

  if (recommendation.kind === 'planning_fallback') {
    const lines = recommendation.areaTitle
      ? [
          `Focus area: **${recommendation.areaTitle}**`,
          '',
          recommendation.primaryReason,
        ]
      : [recommendation.primaryReason];

    return {
      text: lines.join('\n'),
      intent: 'daily_focus',
      recommendedAreaId: recommendation.areaId,
      debugReasoning: recommendation.debugReasoning,
    };
  }

  const alternateLines = recommendation.alternateTaskTitles.length > 0
    ? [
        '',
        'Alternatives:',
        ...recommendation.alternateTaskTitles.map(title => `- **${title}**`),
      ]
    : [];

  return {
    text: [
      `Focus area: **${recommendation.areaTitle}**`,
      '',
      `Best task: **${recommendation.primaryTaskTitle}**`,
      '',
      `Why: ${recommendation.primaryReason}.`,
      ...alternateLines,
    ].join('\n'),
    intent: 'daily_focus',
    recommendedTaskIds: [
      recommendation.primaryTaskId!,
      ...recommendation.alternateTaskIds,
    ],
    recommendedAreaId: recommendation.areaId,
    debugReasoning: recommendation.debugReasoning,
  };
}

export function buildStatusSummaryReply(tasks: Task[], now = new Date()): AssistantReply {
  const snapshot = buildAssistantTaskSnapshot(tasks, now);
  const recommendation = recommendDailyFocus(tasks, now);

  const openCount = snapshot.actionableTasks.length;
  const activeCount = snapshot.activeTasks.length;
  const blockedCount = snapshot.blockedTasks.length;
  const recentCompletedCount = snapshot.recentlyCompleted.length;

  const focusLine = recommendation.kind === 'focused_task'
    ? `Best focus right now is **${recommendation.areaTitle}** via **${recommendation.primaryTaskTitle}**.`
    : recommendation.primaryReason;

  return {
    text: [
      `You have **${openCount} actionable tasks**, **${activeCount}** already in progress, **${blockedCount}** on hold, and **${recentCompletedCount}** completed recently.`,
      '',
      focusLine,
    ].join('\n'),
    intent: 'status_summary',
    recommendedTaskIds: recommendation.kind === 'focused_task' && recommendation.primaryTaskId
      ? [recommendation.primaryTaskId]
      : undefined,
    recommendedAreaId: recommendation.areaId,
    debugReasoning: recommendation.debugReasoning,
  };
}

function formatCandidateLine(task: ActionableTaskCandidate): string {
  const labels = [
    task.status === 'IN_PROGRESS' ? 'in progress' : 'not started',
    task.priority.toLowerCase(),
    task.dueDate ? `due ${formatDateLabel(task.dueDate)}` : null,
    task.scheduledDate ? `scheduled ${formatDateLabel(task.scheduledDate)}` : null,
  ].filter(Boolean);

  return `- ${task.breadcrumb} [${labels.join(', ')}]`;
}

export function buildGeneralChatSystemPrompt(snapshot: AssistantTaskSnapshot, now = new Date()): string {
  const areaLines = snapshot.areas.map(area => {
    const details = [
      `${area.actionableCount} actionable`,
      `${area.activeCount} active`,
      `${area.blockedCount} blocked`,
      area.overdueCount > 0 ? `${area.overdueCount} overdue` : null,
      area.dueTodayCount > 0 ? `${area.dueTodayCount} due today` : null,
      area.topTaskTitle ? `top candidate: ${area.topTaskTitle}` : null,
    ].filter(Boolean);

    return `- ${area.areaTitle}: ${details.join(', ')}`;
  }).join('\n');

  const activeLines = snapshot.activeTasks.slice(0, 6).map(formatCandidateLine).join('\n') || '- none';
  const candidateLines = snapshot.actionableTasks.slice(0, 8).map(formatCandidateLine).join('\n') || '- none';
  const recentCompletedLines = snapshot.recentlyCompleted.slice(0, 5).map(task => {
    const label = task.completedAt ? formatDateLabel(task.completedAt) : 'recently';
    return `- ${task.breadcrumb} (completed ${label})`;
  }).join('\n') || '- none';

  return `You are a helpful and concise local planning assistant for LifeOS.
You are answering questions about the user's current tasks.

Rules:
- Use the live task snapshot below as the source of truth.
- Never recommend completed tasks unless the user explicitly asks about completed work.
- Never treat area names as executable tasks.
- Prefer citing concrete tasks from the actionable candidate list when making recommendations.
- If the data is insufficient, say so plainly.
- Keep answers brief and practical.

Today:
- ${now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

Area summaries:
${areaLines}

Active tasks:
${activeLines}

Top actionable candidates:
${candidateLines}

Recent completions:
${recentCompletedLines}

Archived completed task count:
- ${snapshot.archivedCompletedCount}`;
}

export type {
  ActionableTaskCandidate,
  AssistantAreaSnapshot,
  AssistantIntent,
  AssistantReply,
  AssistantTaskSnapshot,
  AppContext,
  BlockedTaskSummary,
  ChatAdapter,
  ChatMessage,
  CompletedTaskSummary,
  DailyFocusRecommendation,
} from './types';
