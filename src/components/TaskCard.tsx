'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskContext } from '@/lib/task-context';
import { Task } from '@/lib/types';
import { getTaskPath, formatBreadcrumb, getCompletedAgoText, isOverdue } from '@/lib/tasks';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const { tasks, navigateTo, selectTask, updateTask, deleteTask, createTask, currentParentId } = useTaskContext();
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
  const taskIsOverdue = isOverdue(task);

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
    setEditTitle(task.title);
    setIsEditing(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input')) return;
    if (isEditing) return;

    // If has children, drill down. Otherwise open panel
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
    });
    if (hasChildren || true) {
      navigateTo(task.id);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    const subtreeCount = tasks.filter(t => {
      let current: Task | undefined = t;
      while (current && current.parentId !== task.id) {
        current = tasks.find(p => p.id === current?.parentId);
        if (current?.id === task.id) return true;
      }
      return t.parentId === task.id;
    }).length;

    const message = subtreeCount > 0
      ? `Delete "${task.title}" and ${subtreeCount} subtask${subtreeCount > 1 ? 's' : ''}?`
      : `Delete "${task.title}"?`;

    if (confirm(message)) {
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
      className={`
        group relative bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 
        p-3 shadow-sm hover:shadow-md transition-all cursor-pointer
        ${isDragging ? 'opacity-50 shadow-lg' : ''}
        ${taskIsOverdue ? 'border-l-4 border-l-red-500' : ''}
      `}
      onClick={handleCardClick}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 11-4 0 2 2 0 014 0zM7 8a2 2 0 11-4 0 2 2 0 014 0zM7 14a2 2 0 11-4 0 2 2 0 014 0zM13 2a2 2 0 11-4 0 2 2 0 014 0zM13 8a2 2 0 11-4 0 2 2 0 014 0zM13 14a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>

      <div className="pl-4">
        {/* Breadcrumb path (compact) */}
        {breadcrumbText && (
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-1 truncate" title={breadcrumbText}>
            {breadcrumbText}
          </div>
        )}

        {/* Title */}
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
            className="w-full text-sm font-medium bg-transparent border-b border-blue-500 outline-none"
          />
        ) : (
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2"
              onDoubleClick={() => setIsEditing(true)}
            >
              {task.title}
            </h3>
            {hasChildren && (
              <span className="flex-shrink-0 text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                {tasks.filter(t => t.parentId === task.id).length}
              </span>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Due date badge */}
          {task.dueDate && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${taskIsOverdue
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}>
              {taskIsOverdue ? '⚠️ ' : '📅 '}
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}

          {/* Completed ago text */}
          {completedAgo && (
            <span className="text-xs text-green-600 dark:text-green-400">
              ✓ {completedAgo}
            </span>
          )}
        </div>
      </div>

      {/* Context menu button */}
      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 top-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[140px]">
            <button
              onClick={handleOpenDetails}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span>📝</span> Edit Details
            </button>
            <button
              onClick={handleAddSubtask}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span>➕</span> Add Subtask
            </button>
            <hr className="my-1 border-slate-200 dark:border-slate-700" />
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <span>🗑️</span> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
