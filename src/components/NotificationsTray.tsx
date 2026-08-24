'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotificationContext } from '@/lib/notification-context';
import { Notification } from '@/lib/types';
import { useTaskContext } from '@/lib/task-context';

export function NotificationsTray() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotificationContext();
  const { navigateTo } = useTaskContext();
  const [isOpen, setIsOpen] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (trayRef.current && !trayRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.relatedTaskId) {
      navigateTo(notification.relatedTaskId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={trayRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
          isOpen
            ? 'border-[var(--op-accent)] bg-[var(--op-accent)]/10 text-[var(--op-accent)]'
            : 'border-[var(--op-border-strong)] bg-white/[0.03] text-[var(--op-sub)] hover:border-[var(--op-accent)] hover:text-[var(--op-accent)]'
        }`}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--op-accent)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--op-accent)] shadow-[0_0_6px_var(--op-accent)]" />
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-xl border border-[var(--op-border-strong)] bg-[#0a0e15] shadow-2xl backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--op-border)] bg-black/40 px-3.5 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                <span className="text-[var(--op-dim)]">01</span>
                <span className="text-[var(--op-dim)]">{'//'}</span>
                <span className="text-[var(--op-muted)]">NOTIFICATIONS</span>
                {unreadCount > 0 && (
                  <span className="rounded bg-[var(--op-accent)]/15 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-[var(--op-accent)] tabular-nums">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              {notifications.length > 0 && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="font-mono text-[10px] text-[var(--op-accent)] transition-colors hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.03] text-[var(--op-dim)]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-[12px] text-[var(--op-dim)]">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--op-border)]">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`group flex items-start gap-3 p-3.5 transition-colors hover:bg-white/[0.03] cursor-pointer ${
                        notification.read ? 'opacity-70' : 'bg-white/[0.02]'
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="mt-1 flex h-2 w-2 flex-shrink-0 items-center justify-center">
                        {!notification.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--op-accent)] shadow-[0_0_6px_var(--op-accent)]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] font-medium leading-snug ${notification.read ? 'text-[var(--op-sub)]' : 'text-[var(--op-text)]'}`}>
                            {notification.title}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="rounded p-1 text-[var(--op-dim)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                            title="Delete notification"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--op-muted)] line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-1.5 font-mono text-[10px] text-[var(--op-dim)] tabular-nums">
                          {new Date(notification.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
