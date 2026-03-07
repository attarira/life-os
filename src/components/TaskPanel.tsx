'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskContext } from '@/lib/task-context';
import { Task, TaskRecurrence } from '@/lib/types';

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
  const [recurrence, setRecurrence] = useState<TaskRecurrence | undefined>();
  const [isRecurring, setIsRecurring] = useState(false);
  const [isLeaf, setIsLeaf] = useState(false);
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
      setRecurrence(task.recurrence);
      setIsRecurring(!!task.frequency || !!task.recurrence);
      
      const hasChildren = tasks.some(t => t.parentId === task.id);
      setIsLeaf(task.isLeaf !== undefined ? !!task.isLeaf : !hasChildren);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return new Date(y, m - 1, d, 12, 0, 0, 0);
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

  const setRecurrenceAndUpdate = async (newRec?: TaskRecurrence) => {
    setRecurrence(newRec);
    await updateTask(task.id, { recurrence: newRec });
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

  // Status pill config
  const statusOptions: { value: Task['status']; label: string; activeColor: string }[] = [
    { value: 'NOT_STARTED', label: 'Not Started', activeColor: 'bg-slate-500 text-white' },
    { value: 'IN_PROGRESS', label: 'In Progress', activeColor: 'bg-blue-500 text-white' },
    { value: 'ON_HOLD', label: 'On Hold', activeColor: 'bg-amber-500 text-white' },
    { value: 'COMPLETED', label: 'Done', activeColor: 'bg-emerald-500 text-white' },
  ];

  // Priority pill config
  const priorityOptions: { value: Task['priority']; label: string; activeColor: string }[] = [
    { value: 'LOW', label: 'Low', activeColor: 'bg-slate-500 text-white' },
    { value: 'MEDIUM', label: 'Medium', activeColor: 'bg-blue-500 text-white' },
    { value: 'HIGH', label: 'High', activeColor: 'bg-rose-500 text-white' },
  ];

  const completedCount = subtasks.filter(s => s.status === 'COMPLETED').length;
  const totalSubtasks = subtasks.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => selectTask(null)}
      />

      {/* Modal */}
      <div
        ref={panelRef}
        className="relative w-full max-w-[640px] bg-[#0f1219] text-slate-100 shadow-2xl rounded-2xl border border-slate-800/60 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
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
                  className="w-full bg-transparent text-xl font-bold text-white border-b-2 border-blue-500/60 focus:border-blue-400 focus:outline-none pb-0.5 transition-colors"
                />
              ) : (
                <h2
                  className="text-xl font-bold text-white truncate cursor-text hover:text-blue-100 transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to edit title"
                >
                  {task.title}
                </h2>
              )}
            </div>
            <button
              onClick={() => selectTask(null)}
              className="p-1.5 -mr-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition-all"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Scrollable Body ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-7">

            {/* ── Description ── */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2.5">
                Description
              </label>
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
                className="w-full min-h-[80px] bg-slate-800/40 text-slate-100 rounded-xl border border-slate-700/50 px-4 py-3 text-sm leading-relaxed placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all resize-none"
                placeholder="Add a description..."
              />
            </div>

            {/* ── Status & Priority (side by side) ── */}
            <div className="grid grid-cols-[3fr_2fr] gap-6">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map((option) => {
                    const isActive = task.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateTask(task.id, { status: option.value })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${isActive
                          ? `${option.activeColor} shadow-sm`
                          : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/70 border border-slate-700/40'
                          }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">
                  Priority
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {priorityOptions.map((option) => {
                    const isActive = task.priority === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateTask(task.id, { priority: option.value })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${isActive
                          ? `${option.activeColor} shadow-sm`
                          : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/70 border border-slate-700/40'
                          }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Timeline (Due Date) ── */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">
                Due Date
              </label>
              <div className="grid grid-cols-1 gap-4">
                {/* Due Date */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3M16 3v3M4 11h16M5 20h14a1 1 0 001-1V7a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />
                    </svg>
                  </span>
                  {!dueDate && (
                    <span className="absolute left-9 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                      Due Date
                    </span>
                  )}
                  <input
                    id="task-due-date"
                    type="date"
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {
                        // ignore
                      }
                    }}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    onBlur={handleDueDateSave}
                    className={`w-full rounded-xl bg-slate-800/40 border border-slate-700/50 px-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit]:py-0 ${dueDate ? 'text-slate-100' : 'text-transparent'
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-500 hover:text-slate-200 transition-colors z-10"
                      aria-label="Clear due date"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Frequency & Recurrence ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Recurring Task
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !isRecurring;
                    setIsRecurring(nextVal);
                    if (!nextVal) {
                      setFrequency('');
                      setRecurrence(undefined);
                      await updateTask(task.id, { frequency: undefined, recurrence: undefined });
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isRecurring ? 'bg-blue-500' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isRecurring ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                </button>
              </div>

              {isRecurring && (
                <div className="space-y-4 mt-2 bg-slate-800/20 p-4 rounded-xl border border-slate-700/30">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2.5">
                      Frequency (Label)
                    </label>
                    <input
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      onBlur={handleFrequencySave}
                      placeholder="Daily, 2x a week, every Friday..."
                      className="w-full rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-600">Shown on the card instead of &ldquo;Ongoing&rdquo;.</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2.5">
                      Planner Recurrence
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                        let activeDays: number[] = [];
                        if (recurrence) {
                          if (recurrence.rule === 'custom') activeDays = recurrence.daysOfWeek || [];
                          else if (recurrence.rule === 'daily') activeDays = [0, 1, 2, 3, 4, 5, 6];
                          else if (recurrence.rule === 'weekdays') activeDays = [1, 2, 3, 4, 5];
                          else if (recurrence.rule === 'weekends') activeDays = [0, 6];
                          else if (recurrence.rule === 'mwf') activeDays = [1, 3, 5];
                          else if (recurrence.rule === 'tth') activeDays = [2, 4];
                        }
                        const isSelected = activeDays.includes(idx);
                        
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={async () => {
                              const nextDays = isSelected
                                ? activeDays.filter(d => d !== idx)
                                : [...activeDays, idx].sort((a, b) => a - b);
                                
                              if (nextDays.length === 0) {
                                await setRecurrenceAndUpdate(undefined);
                              } else {
                                await setRecurrenceAndUpdate({ rule: 'custom', daysOfWeek: nextDays });
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isSelected ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20' : 'bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                              }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">Scheduled task will automatically appear on the daily planner.</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-slate-800/50" />

            {/* ── Subtasks Toggle ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Leaf Task
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !isLeaf;
                    setIsLeaf(nextVal);
                    await updateTask(task.id, { isLeaf: nextVal });
                    if (nextVal) {
                      setSubtasksOpen(false);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isLeaf ? 'bg-blue-500' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isLeaf ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                </button>
              </div>

              {!isLeaf && (
                <div className="space-y-4 mt-2 bg-slate-800/20 p-4 rounded-xl border border-slate-700/30">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setSubtasksOpen(!subtasksOpen)}
                      className="flex items-center gap-2 group"
                      aria-expanded={subtasksOpen}
                    >
                      <svg
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform ${subtasksOpen ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 group-hover:text-slate-200 transition-colors">
                        Subtasks
                      </span>
                      {totalSubtasks > 0 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {completedCount}/{totalSubtasks}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Add subtask input */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                        </svg>
                      </span>
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
                        placeholder="Add a subtask..."
                        className="w-full rounded-xl bg-slate-800/40 border border-slate-700/50 pl-9 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      disabled={!newSubtaskTitle.trim()}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${newSubtaskTitle.trim()
                        ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 hover:text-blue-300 border border-blue-500/20'
                        : 'bg-slate-800/40 text-slate-600 border border-slate-700/30 cursor-not-allowed'
                        }`}
                      aria-label="Add subtask"
                    >
                      Add
                    </button>
                  </div>

                  {/* Subtask list */}
                  {subtasksOpen && (
                    <div className="mt-3 space-y-0.5">
                      {subtasks.length === 0 ? (
                        <p className="text-xs text-slate-600 py-2 pl-1">No subtasks yet.</p>
                      ) : (
                        <div className="space-y-0.5">
                          {subtasks.map(subtask => (
                            <div
                              key={subtask.id}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800/50 transition-colors group"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleSubtask(subtask)}
                                className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${subtask.status === 'COMPLETED'
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'border-slate-600 hover:border-slate-400'
                                  }`}
                              >
                                {subtask.status === 'COMPLETED' && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => selectTask(subtask.id)}
                                className={`text-sm text-left flex-1 transition-colors ${subtask.status === 'COMPLETED'
                                  ? 'text-slate-500 line-through'
                                  : 'text-slate-200 hover:text-white'
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
              )}
            </div>
          </div>
        </div>

        {/* ─── Sticky Footer ─── */}
        <div className="px-6 py-4 border-t border-slate-800/50 bg-[#0a0d13] rounded-b-2xl">
          <div className="flex items-center justify-between">
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 active:scale-[0.97]"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div >
  );
}
