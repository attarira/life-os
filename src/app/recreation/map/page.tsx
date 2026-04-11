'use client';

import React from 'react';
import Link from 'next/link';
import { VisitedMap } from '@/components/VisitedMap';
import { useTravelMode } from '@/lib/travel-mode-context';

export default function RecreationMapPage() {
  const { enabled, setEnabled } = useTravelMode();

  if (enabled) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950">
        <header className="border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="mx-auto flex max-w-[1200px] items-center gap-2 text-sm text-slate-300">
            <Link href="/" className="font-semibold text-white hover:text-white/80 transition-colors">LifeOS</Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Recreation</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Visited Places</span>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-800 bg-slate-900/70 p-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Travel Mode</p>
            <h1 className="mt-3 text-2xl font-semibold text-white">Travel mode hides this view.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Maps and other secondary surfaces stay out of the way while LifeOS is in its reduced travel shell.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
              >
                Return Home
              </Link>
              <button
                type="button"
                onClick={() => setEnabled(false)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
              >
                Turn Off Travel Mode
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 min-h-screen">
      <header className="flex-shrink-0 bg-slate-950 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Link href="/" className="font-semibold text-white hover:text-white/80 transition-colors">LifeOS</Link>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">Recreation</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">Visited Places</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto p-6 space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Places I&apos;ve Visited</h1>
            <p className="text-slate-400">A visual record of countries and states I have traveled to.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="xl:col-span-2 h-[500px]">
              <VisitedMap type="world" />
            </div>
            <div className="h-[450px]">
              <VisitedMap type="usa" />
            </div>
            <div className="h-[450px]">
              <VisitedMap type="india" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
