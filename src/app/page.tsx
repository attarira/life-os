'use client';

import { TaskProvider } from '@/lib/task-context';
import { Board } from '@/components';

export default function Home() {
  return (
    <TaskProvider>
      <Board />
    </TaskProvider>
  );
}
