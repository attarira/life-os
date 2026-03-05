'use client';

import { TaskProvider } from '@/lib/task-context';
import { Board } from '@/components';
import { NotificationProvider } from '@/lib/notification-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { FileSystemProvider } from '@/lib/file-system-context';

export default function Home() {
  return (
    <TaskProvider>
      <NotificationProvider>
        <CurrencyProvider>
          <FileSystemProvider>
            <Board />
          </FileSystemProvider>
        </CurrencyProvider>
      </NotificationProvider>
    </TaskProvider>
  );
}
