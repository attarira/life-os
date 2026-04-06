'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getTaskPath } from '@/lib/tasks';
import { storage } from '@/lib/utils';
import type { AppContext, ChatAdapter, ChatMessage } from '@/lib/assistant';

// ─── Default Local Adapter ───────────────────────────────────────────────────
// A simple echo adapter that demonstrates command parsing.
// Replace with your API call to OpenClaw, etc.

export const localChatAdapter: ChatAdapter = async (message, _history, context) => {
  const lower = message.toLowerCase().trim();

  // Navigation commands
  if (lower.startsWith('go to ') || lower.startsWith('open ')) {
    const query = lower.replace(/^(go to|open)\s+/i, '').trim();
    const match = context.tasks.find(
      (t) => t.title.toLowerCase().includes(query)
    );
    if (match) {
      if (match.parentId === 'root') {
        context.navigateTo(match.id);
        context.selectTask(null);
      } else {
        const path = getTaskPath(context.tasks, match.id);
        const area = path[0];
        if (area) context.navigateTo(area.id);
        context.selectTask(match.id);
      }
      return {
        text: `Opened **${match.title}**.`,
        intent: 'task_lookup',
        recommendedTaskIds: match.parentId === 'root' ? undefined : [match.id],
      };
    }
    return {
      text: `I couldn't find a project or area matching "${query}". Try one of: ${context.tasks
        .filter((t) => t.parentId === 'root')
        .map((t) => t.title)
        .join(', ')}.`,
      intent: 'task_lookup',
    };
  }

  // Status query
  if (lower.includes('status') || lower.includes('summary') || lower.includes('how am i doing')) {
    const areas = context.tasks.filter((t) => t.parentId === 'root' && !t.calendarOnly);
    const inProgress = context.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const total = context.tasks.filter((t) => t.parentId !== 'root' && t.status !== 'COMPLETED').length;
    return {
      text: `You have **${areas.length} life areas** with **${total} open tasks**. Currently **${inProgress}** are in progress.`,
      intent: 'status_summary',
    };
  }

  // Help
  if (lower === 'help' || lower === '?') {
    return {
      text: `Here's what I can do:\n\n• **go to [area]** — Navigate to a life area\n• **open [project]** — Open a specific task or project\n• **status** — Get a quick summary of your tasks\n• **which task should I work on today?** — Get a deterministic focus recommendation\n• **help** — Show this message`,
      intent: 'general_chat',
    };
  }

  // Default echo
  return {
    text: `I received: "${message}"\n\nType **help** to see available commands.`,
    intent: 'general_chat',
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// ─── Component ───────────────────────────────────────────────────────────────

import { ollamaCommandAdapter } from '@/lib/ollamaAdapter';
import { MarkdownMessage } from './MarkdownMessage';
export type { AppContext, ChatAdapter, ChatMessage } from '@/lib/assistant';

type ChatPanelProps = {
  adapter?: ChatAdapter;
  appContext: AppContext;
  collapsed?: boolean;
  onToggle?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
};

export function ChatPanel({
  adapter = ollamaCommandAdapter,
  appContext,
  collapsed = false,
  onToggle,
  isExpanded = false,
  onToggleExpand,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('lifeos-chat-history');
        if (saved) {
          const parsed = JSON.parse(saved) as Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
          // Revive dates
          return parsed.map((message) => ({ ...message, timestamp: new Date(message.timestamp) }));
        }
      } catch (error) {
        console.warn('Failed to load chat history', error);
      }
    }
    return [{
      id: 'welcome',
      role: 'system',
      content: 'Welcome to LifeOS. Ask me anything about your tasks.',
      timestamp: new Date(),
    }];
  });

  const [draft, setDraft] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showDebugReasoning = typeof window !== 'undefined'
    ? storage.get<boolean>('lifeos:assistant-debug:v1', false) || process.env.NODE_ENV !== 'production'
    : false;

  // Save to localStorage when messages change
  useEffect(() => {
    try {
      localStorage.setItem('lifeos-chat-history', JSON.stringify(messages));
    } catch (err) {
      console.warn('Failed to save chat history', err);
    }
  }, [messages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Focus input when expanded
  useEffect(() => {
    if (!collapsed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [collapsed]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = {
      id: buildId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setIsProcessing(true);

    try {
      const reply = await adapter(text, [...messages, userMsg], appContext);
      const assistantMsg: ChatMessage = {
        id: buildId(),
        role: 'assistant',
        content: reply.text,
        timestamp: new Date(),
        intent: reply.intent,
        recommendedTaskIds: reply.recommendedTaskIds,
        recommendedAreaId: reply.recommendedAreaId,
        debugReasoning: reply.debugReasoning,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: buildId(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  }, [draft, isProcessing, adapter, messages, appContext]);

  const handleRecommendationClick = useCallback((taskId: string) => {
    const task = appContext.tasks.find(candidate => candidate.id === taskId);
    if (!task) return;

    if (task.parentId === 'root') {
      appContext.navigateTo(task.id);
      appContext.selectTask(null);
      return;
    }

    const path = getTaskPath(appContext.tasks, task.id);
    const area = path[0];
    if (area) {
      appContext.navigateTo(area.id);
    }
    appContext.selectTask(task.id);
  }, [appContext]);

  // ─── Collapsed State ─────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        aria-label="Open chat"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-[10px] uppercase tracking-[0.22em] [writing-mode:vertical-rl] rotate-180">
          Chat
        </span>
      </button>
    );
  }

  // ─── Expanded State ───────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Assistant</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Local mode</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMessages([{
                id: 'welcome',
                role: 'system',
                content: 'Chat cleared. Type **help** to see what I can do.',
                timestamp: new Date(),
              }])}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            {onToggleExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            )}
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Collapse chat"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${msg.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-sm'
                : msg.role === 'system'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 rounded-bl-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                }`}
            >
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="space-y-2">
                  <MarkdownMessage content={msg.content} />
                  {msg.recommendedTaskIds && msg.recommendedTaskIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.recommendedTaskIds.map((taskId) => {
                        const task = appContext.tasks.find(candidate => candidate.id === taskId);
                        if (!task) return null;
                        return (
                          <button
                            key={taskId}
                            type="button"
                            onClick={() => handleRecommendationClick(taskId)}
                            className="rounded-full border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-200 hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                          >
                            Open {task.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {showDebugReasoning && msg.debugReasoning && msg.debugReasoning.length > 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-900/40 px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <p className="mb-1 uppercase tracking-[0.14em] text-[10px]">Assistant debug</p>
                      <ul className="space-y-1">
                        {msg.debugReasoning.map((reason, index) => (
                          <li key={`${msg.id}-reason-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'
                }`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl rounded-bl-sm px-3 py-2.5">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500/40 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me anything..."
            disabled={isProcessing}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1.5 text-center">
          Powered by <span className="text-slate-500 dark:text-slate-500">local task intelligence + Ollama</span>
        </p>
      </div>
    </div>
  );
}
