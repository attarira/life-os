'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { Task } from '@/lib/types';

export function TaskPanel() {
  const { tasks, selectedTaskId, selectTask, updateTask, deleteTask, createTask } = useTaskContext();
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [subtasksOpen, setSubtasksOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [frequency, setFrequency] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const task = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      setScheduledDate(task.scheduledDate ? new Date(task.scheduledDate).toISOString().split('T')[0] : '');
      setEditTitle(task.title || '');
      setIsEditingTitle(false);
      setSubtasksOpen(false);
      setNewSubtaskTitle('');
      setFrequency(task.frequency || '');
    }
  }, [task]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!descriptionRef.current) return;
    descriptionRef.current.style.height = 'auto';
    descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
  }, [description]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedTaskId) {
        selectTask(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, selectTask]);

  const taskId = task?.id ?? null;
  const subtasks = useMemo(
    () => {
      if (!taskId) return [];
      return tasks.filter(t => t.parentId === taskId).sort((a, b) => a.order - b.order);
    },
    [tasks, taskId]
  );

  if (!task) return null;

  const parseDateInput = (value: string) => {
    const parts = value.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d, 12, 0, 0, 0); // local noon to avoid TZ rollover
    }
    return new Date(value);
  };

  const handleDescriptionSave = async () => {
    if (description !== (task.description || '')) {
      await updateTask(task.id, { description: description || undefined });
    }
  };

  const handleTitleSave = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditTitle(task.title || '');
      setIsEditingTitle(false);
      return;
    }
    if (trimmed !== task.title) {
      await updateTask(task.id, { title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleDueDateSave = async () => {
    const newDate = dueDate ? parseDateInput(dueDate) : undefined;
    if (newDate?.toISOString() !== task.dueDate?.toISOString()) {
      await updateTask(task.id, { dueDate: newDate });
    }
  };

  const handleScheduledDateSave = async () => {
    const newDate = scheduledDate ? parseDateInput(scheduledDate) : undefined;
    if (newDate?.toISOString() !== task.scheduledDate?.toISOString()) {
      await updateTask(task.id, { scheduledDate: newDate });
    }
  };

  const handleFrequencySave = async () => {
    const trimmed = frequency.trim();
    const current = task.frequency || '';
    if (trimmed !== current) {
      await updateTask(task.id, { frequency: trimmed || undefined });
    }
  };

  const handleAddSubtask = async () => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    await createTask({
      parentId: task.id,
      title: trimmed,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
    });
    setNewSubtaskTitle('');
    setSubtasksOpen(true);
  };

  const handleToggleSubtask = async (subtask: Task) => {
    const nextStatus = subtask.status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED';
    await updateTask(subtask.id, { status: nextStatus });
  };

  const handleDelete = async () => {
    const subtreeCount = tasks.filter(t => t.parentId === task.id).length;
    const message = subtreeCount > 0
      ? `Delete "${task.title}" and all its subtasks?`
      : `Delete "${task.title}"?`;

    if (confirm(message)) {
      await deleteTask(task.id);
    }
  };

  const handleSaveAll = async () => {
    await handleTitleSave();
    await handleDescriptionSave();
    await handleScheduledDateSave();
    await handleDueDateSave();
    await handleFrequencySave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => selectTask(null)}
      />

      <div
        ref={panelRef}
        className="relative w-full max-w-2xl bg-slate-900 text-slate-100 shadow-2xl rounded-2xl border border-slate-800/80 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') {
                      setEditTitle(task.title || '');
                      setIsEditingTitle(false);
                    }
                  }}
                  className="w-full bg-transparent text-lg font-semibold text-slate-100 border-b border-slate-700/60 focus:outline-none focus:border-slate-500/70"
                />
              ) : (
                <h2
                  className="text-lg font-semibold text-slate-100 truncate cursor-text"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {task.title}
                </h2>
              )}
            </div>
            <button
              onClick={() => selectTask(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 px-5 pb-4 space-y-5 overflow-y-auto">
          <div>
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionSave}
              onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              rows={3}
              className="w-full min-h-[120px] bg-slate-800/50 text-slate-100 rounded-xl px-3 py-2 text-sm leading-relaxed placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
              placeholder="What's this task about?"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">Status</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'NOT_STARTED', label: 'Not Started' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'ON_HOLD', label: 'On Hold' },
                  { value: 'COMPLETED', label: 'Done' },
                ].map((option) => {
                  const isActive = task.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateTask(task.id, { status: option.value as Task['status'] })}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70 ${
                        isActive
                          ? 'bg-slate-700/70 text-white ring-1 ring-slate-500/60'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">Priority</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'LOW', label: 'Low' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HIGH', label: 'High' },
                ].map((option) => {
                  const isActive = task.priority === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateTask(task.id, { priority: option.value as Task['priority'] })}
                      className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/70 ${
                        isActive
                          ? 'bg-slate-700/70 text-white ring-1 ring-slate-500/60'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">Dates</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.14em] text-slate-400" htmlFor="task-scheduled-date">
                  Scheduled
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3M16 3v3M4 11h16M5 20h14a1 1 0 001-1V7a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />
                    </svg>
                  </span>
                  {!scheduledDate && (
                    <span className="absolute left-9 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                      Start
                    </span>
                  )}
                  <input
                    id="task-scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    onBlur={handleScheduledDateSave}
                    className={`w-full rounded-xl bg-slate-800/50 px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-600 ${
                      scheduledDate ? 'text-slate-100' : 'text-transparent'
                    }`}
                    aria-label="Scheduled date"
                  />
                  {scheduledDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduledDate('');
                        updateTask(task.id, { scheduledDate: undefined });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      aria-label="Clear scheduled date"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] uppercase tracking-[0.14em] text-slate-400" htmlFor="task-due-date">
                  Due
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3M16 3v3M4 11h16M5 20h14a1 1 0 001-1V7a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />
                    </svg>
                  </span>
                  {!dueDate && (
                    <span className="absolute left-9 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                      Due
                    </span>
                  )}
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    onBlur={handleDueDateSave}
                    className={`w-full rounded-xl bg-slate-800/50 px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-600 ${
                      dueDate ? 'text-slate-100' : 'text-transparent'
                    }`}
                    aria-label="Due date"
                  />
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate('');
                        updateTask(task.id, { dueDate: undefined });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      aria-label="Clear due date"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {task.status === 'IN_PROGRESS' && !task.dueDate && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-2">Frequency</div>
              <input
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                onBlur={handleFrequencySave}
                placeholder="Daily, 2x a week, every Friday..."
                className="w-full rounded-xl bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <p className="mt-1 text-xs text-slate-500">Shown instead of “Ongoing” for no-due tasks.</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSubtasksOpen(!subtasksOpen)}
                className="text-xs uppercase tracking-[0.16em] text-slate-400 hover:text-slate-200"
                aria-expanded={subtasksOpen}
              >
                Subtasks
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  onFocus={() => setSubtasksOpen(true)}
                  placeholder="Add subtask"
                  className="w-40 rounded-lg bg-slate-800/60 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className={`p-1.5 rounded-lg bg-slate-800/70 text-slate-300 ${
                    newSubtaskTitle.trim()
                      ? 'hover:text-white hover:bg-slate-700'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  aria-label="Add subtask"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                  </svg>
                </button>
              </div>
            </div>
            {subtasksOpen && (
              <div className="mt-3 space-y-2">
                {subtasks.length === 0 ? (
                  <p className="text-xs text-slate-500">No subtasks yet.</p>
                ) : (
                  <div className="space-y-1">
                    {subtasks.map(subtask => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800/60"
                      >
                        <input
                          type="checkbox"
                          checked={subtask.status === 'COMPLETED'}
                          onChange={() => handleToggleSubtask(subtask)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-slate-200 focus-visible:ring-2 focus-visible:ring-slate-500/70"
                        />
                        <button
                          type="button"
                          onClick={() => selectTask(subtask.id)}
                          className={`text-sm text-left ${
                            subtask.status === 'COMPLETED'
                              ? 'text-slate-500 line-through'
                              : 'text-slate-100'
                          }`}
                        >
                          {subtask.title}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-4 pt-3 flex items-center justify-end gap-2 border-t border-slate-800/70">
          <button
            onClick={handleDelete}
            className="px-3 py-2 text-xs font-semibold text-rose-300 hover:text-rose-200"
          >
            Delete
          </button>
          <button
            onClick={handleSaveAll}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-900 hover:bg-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
