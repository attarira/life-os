import React, { useState } from 'react';
import { TaskStatusRing, TaskStatusData } from './TaskStatusRing';

export function TaskStatusRingExample() {
  const [data, setData] = useState<TaskStatusData>({
    notStarted: 10,
    inProgress: 8,
    onHold: 5,
    completed: 2
  });

  const [clicked, setClicked] = useState<string | null>(null);

  const randomize = () => {
    setData({
      notStarted: Math.floor(Math.random() * 20),
      inProgress: Math.floor(Math.random() * 20),
      completed: Math.floor(Math.random() * 20),
      onHold: Math.floor(Math.random() * 10),
    });
    setClicked(null);
  };

  const setZero = () => {
    setData({ notStarted: 0, inProgress: 0, completed: 0, onHold: 0 });
    setClicked(null);
  };

  const total = Object.values(data).reduce((sum: number, val) => sum + (val || 0), 0) || 0;

  return (
    <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-xl max-w-md mx-auto flex flex-col items-center gap-8 border border-zinc-200 dark:border-zinc-800">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Task Distribution</h3>
        <p className="text-sm text-zinc-500">Interactive D3.js Donut Chart</p>
      </div>

      <div className="relative flex items-center justify-center p-8 bg-white dark:bg-zinc-800/50 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700/50">
        <TaskStatusRing
          data={data}
          size={160}
          innerRadius={48}
          outerRadius={64}
          onStatusClick={(status) => setClicked(status)}
        />

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-zinc-900 dark:text-white">
            {total}
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-0.5">Total</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full">
        {clicked ? (
          <div className="text-sm text-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2.5 rounded-lg border border-blue-100 dark:border-blue-500/20">
            Clicked Segment: <span className="font-semibold capitalize">{clicked.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
        ) : (
          <div className="text-sm text-center text-zinc-500 p-2.5">
            Click a segment to test interaction
          </div>
        )}

        <div className="flex gap-2 justify-center mt-2">
          <button
            onClick={randomize}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white transition-colors shadow-sm"
          >
            Randomize Data
          </button>
          <button
            onClick={setZero}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Clear Data
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskStatusRingExample;
