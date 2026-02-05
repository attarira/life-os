'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskContext } from '@/lib/task-context';
import { Task } from '@/lib/types';
import { getTaskPath, formatBreadcrumb, getCompletedAgoText } from '@/lib/tasks';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  accentColor?: string; // e.g. "border-blue-500"
}

export function TaskCard({ task, isDragging, accentColor }: TaskCardProps) {
  const { tasks, navigateTo, selectTask, updateTask, deleteTask, createTask } = useTaskContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Get path for this task
  const path = getTaskPath(tasks, task.id);
  const pathWithoutSelf = path.slice(0, -1);
  const breadcrumbText = pathWithoutSelf.length > 0
    ? formatBreadcrumb(pathWithoutSelf, 40)
    : '';

  // Check if task has children
  const hasChildren = tasks.some(t => t.parentId === task.id);
  const completedAgo = task.status === 'COMPLETED' ? getCompletedAgoText(task) : '';

  // Date logic
  const referenceDate = new Date(2026, 1, 4);
  const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
  const scheduledDateObj = task.scheduledDate ? new Date(task.scheduledDate) : null;
  const scheduledLabel = scheduledDateObj
    ? scheduledDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilScheduled = scheduledDateObj
    ? Math.ceil((scheduledDateObj.getTime() - referenceDate.getTime()) / msPerDay)
    : null;
  const isPending = task.status === 'NOT_STARTED' && daysUntilScheduled !== null && daysUntilScheduled > 7;

  const timeRemainingTag = (() => {
    if (task.status === 'COMPLETED' || !dueDateObj) return null;
    const daysLeft = Math.ceil((dueDateObj.getTime() - referenceDate.getTime()) / msPerDay);
    if (daysLeft < 0) {
      const overdueDays = Math.abs(daysLeft);
      return {
        label: `${overdueDays} Day${overdueDays === 1 ? '' : 's'} Overdue`,
        className: 'border-red-500/40 bg-red-500/10 text-red-300',
      };
    }
    if (daysLeft < 32) {
      return {
        label: `${daysLeft} Day${daysLeft === 1 ? '' : 's'} Left`,
        className: 'border-slate-600/50 bg-slate-800/60 text-slate-200',
      };
    }
    const monthsLeft = Math.round(daysLeft / 30);
    return {
      label: `${monthsLeft} Month${monthsLeft === 1 ? '' : 's'} Left`,
      className: 'border-slate-600/50 bg-slate-800/60 text-slate-200',
    };
  })();

  const statusTags: { label: string; className: string }[] = [];

  if (task.status === 'COMPLETED') {
    statusTags.push({ label: 'Done', className: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' });
  } else {
    if (task.status === 'IN_PROGRESS' && !dueDateObj) {
      statusTags.push({ label: 'Ongoing', className: 'text-slate-200 border-slate-500/40 bg-slate-500/15 font-semibold' });
    }
    if (task.status === 'NOT_STARTED' && scheduledDateObj) {
      statusTags.push({ label: `Scheduled ${scheduledLabel}`, className: 'text-slate-500 border-slate-500/30 bg-slate-500/10' });
      if (isPending) {
        statusTags.push({ label: 'Pending', className: 'text-slate-500 border-slate-500/30 bg-slate-500/10' });
      }
    }
    if (task.status === 'ON_HOLD') {
      statusTags.push({ label: 'On Hold', className: 'text-amber-300 border-amber-400/30 bg-amber-400/10' });
    }
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = async () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      await updateTask(task.id, { title: trimmed });
    }
    setEditTitle(task.title || trimmed); // Sync back if change failed or was empty
    setIsEditing(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    if (isEditing) return;

    if (hasChildren) {
      navigateTo(task.id);
    } else {
      selectTask(task.id);
    }
  };

  const handleAddSubtask = async () => {
    setShowMenu(false);
    await createTask({
      parentId: task.id,
      title: 'New Subtask',
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
    });
    // Optional: navigateTo(task.id);
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (confirm(`Delete "${task.title}"?`)) {
      await deleteTask(task.id);
    }
  };

  const handleOpenDetails = () => {
    setShowMenu(false);
    selectTask(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 
        p-2.5 shadow-sm transition-all cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700
        ${isDragging ? 'opacity-50 shadow-lg cursor-grabbing' : ''}
      `}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setEditTitle(task.title);
                setIsEditing(false);
              }
            }}
            className="w-full text-sm font-medium bg-transparent border-b border-blue-500 outline-none p-0"
          />
        ) : (
          <>
            <h3
              className={`text-sm font-medium leading-snug ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              {task.title}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-opacity"
                aria-label="Task actions"
              >
                <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {task.status !== 'COMPLETED' && (
          <div className="flex gap-0.5">
            <div className={`w-1 h-3 rounded-full ${task.priority === 'HIGH' ? 'bg-red-400' : task.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-300'}`} />
            {task.priority === 'HIGH' && <div className="w-1 h-3 rounded-full bg-red-400" />}
          </div>
        )}

        {statusTags.map((tag) => (
          <span key={tag.label} className={`text-[11px] px-2 py-0.5 rounded-md border ${tag.className}`}>
            {tag.label}
          </span>
        ))}

        {timeRemainingTag && (
          <span className={`text-[10px] px-2 py-0.5 rounded-md border uppercase tracking-[0.08em] ${timeRemainingTag.className}`}>
            {timeRemainingTag.label}
          </span>
        )}

        {hasChildren && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {tasks.filter(t => t.parentId === task.id).length}
          </span>
        )}
      </div>

      {/* Popover Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-1 top-6 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsEditing(true)}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Rename
          </button>
          <button
            onClick={handleOpenDetails}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Details
          </button>
          <button
            onClick={handleAddSubtask}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Subtask
          </button>
          <hr className="my-1 border-slate-100" />
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-600"
          >
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
