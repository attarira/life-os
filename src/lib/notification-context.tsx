'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Notification } from './types';
import { useTaskContext } from './task-context';
import {
  generateDailySummaryNotification,
  generateWeeklySummaryNotification,
  checkDueTasksForNotifications
} from './notifications';
import {
  listNotifications,
  addNotifications,
  markRead as repoMarkRead,
  markAllRead as repoMarkAllRead,
  deleteNotification as repoDeleteNotification,
  clearAllNotifications,
} from './repos/notifications';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  deleteNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { tasks, isLoading: tasksLoading } = useTaskContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from the store (Supabase or local fallback)
  useEffect(() => {
    listNotifications()
      .then(setNotifications)
      .catch((error) => console.error('Failed to load notifications:', error))
      .finally(() => setIsInitialized(true));
  }, []);

  // Triggers check
  useEffect(() => {
    if (!isInitialized || tasksLoading) return;

    const checkTriggers = () => {
      if (tasks.length === 0) return;
      const newNotifications: Notification[] = [];

      const daily = generateDailySummaryNotification(tasks);
      if (daily) newNotifications.push(daily);

      const weekly = generateWeeklySummaryNotification(tasks);
      if (weekly) newNotifications.push(weekly);

      const dueTasks = checkDueTasksForNotifications(tasks);
      if (dueTasks.length > 0) newNotifications.push(...dueTasks);

      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev]);
        addNotifications(newNotifications).catch((error) => console.error('Failed to persist notifications:', error));
      }
    };

    checkTriggers();

    // Check every hour (3600000 ms) while the page is open
    const interval = setInterval(checkTriggers, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isInitialized, tasksLoading, tasks]);

  // Notifications older than the retention window are pruned by the store on load.

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    repoMarkRead(id).catch((error) => console.error('Failed to mark notification read:', error));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    repoMarkAllRead().catch((error) => console.error('Failed to mark all read:', error));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    clearAllNotifications().catch((error) => console.error('Failed to clear notifications:', error));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    repoDeleteNotification(id).catch((error) => console.error('Failed to delete notification:', error));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        deleteNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
