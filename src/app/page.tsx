'use client';

import { TaskProvider } from '@/lib/task-context';
import { Board } from '@/components';
import { NotificationProvider } from '@/lib/notification-context';
import { CurrencyProvider } from '@/lib/currency-context';
import { AuthGate } from '@/components/auth/AuthGate';

export default function Home() {
  return (
    <AuthGate>
      <TaskProvider>
        <NotificationProvider>
          <CurrencyProvider>
            <Board />
          </CurrencyProvider>
        </NotificationProvider>
      </TaskProvider>
    </AuthGate>
  );
}
