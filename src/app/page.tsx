'use client';

import { TaskProvider } from '@/lib/task-context';
import { Board } from '@/components';
import { NotificationProvider } from '@/lib/notification-context';

export default function Home() {
  return (
    <TaskProvider>
      <NotificationProvider>
        <Board />
      </NotificationProvider>
    </TaskProvider>
  );
}
