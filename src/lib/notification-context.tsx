'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Notification } from './types';
import { useTaskContext } from './task-context';
import { NOTIFICATIONS_STORAGE_KEY } from './storage-keys';
import {
  generateDailySummaryNotification,
  generateWeeklySummaryNotification,
  checkDueTasksForNotifications
} from './notifications';

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

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored).map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt)
        }));
        setNotifications(parsed);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }, [notifications, isInitialized]);

  // Triggers check
  useEffect(() => {
    if (!isInitialized || tasksLoading) return;

    const checkTriggers = () => {
      if (tasks.length === 0) return;
      let newNotifications: Notification[] = [];

      const daily = generateDailySummaryNotification(tasks);
      if (daily) newNotifications.push(daily);

      const weekly = generateWeeklySummaryNotification(tasks);
      if (weekly) newNotifications.push(weekly);

      const dueTasks = checkDueTasksForNotifications(tasks);
      if (dueTasks.length > 0) newNotifications.push(...dueTasks);

      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev]);
      }
    };

    checkTriggers();

    // Check every hour (3600000 ms) while the page is open
    const interval = setInterval(checkTriggers, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isInitialized, tasksLoading, tasks]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
