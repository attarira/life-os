'use client';

import React, { useState } from 'react';
import { useTravelMode } from '@/lib/travel-mode-context';
import Link from 'next/link';
import { RegionType } from '@/data/visitedRegions';
import { GlobalTray } from './GlobalTray';
import { VisitedMap } from './VisitedMap';

const TRAVEL_MAP_TYPES: Array<{ key: RegionType; label: string }> = [
  { key: 'world', label: 'Countries' },
  { key: 'usa', label: 'US States' },
  { key: 'india', label: 'India States' },
];

export function TravelModeHomeDashboard() {
  const { setEnabled } = useTravelMode();
  const [activeMapType, setActiveMapType] = useState<RegionType>('world');

  return (
    <div className="flex min-h-full flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="font-semibold text-white">LifeOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">Home</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            Travel Mode
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-1">
            <GlobalTray />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[1200px] space-y-6">
          <section className="rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.82))] px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Travel Mode</p>
                <h1 className="mt-2 text-2xl font-semibold text-white">LifeOS is in low-maintenance mode.</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Quick check-ins only: capture something new, review what is active, and use search to jump where you need.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(false)}
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
              >
                Turn Off Travel Mode
              </button>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Travel Map</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 p-1">
                  {TRAVEL_MAP_TYPES.map((mapType) => (
                    <button
                      key={mapType.key}
                      type="button"
                      onClick={() => setActiveMapType(mapType.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeMapType === mapType.key
                          ? 'bg-white text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {mapType.label}
                    </button>
                  ))}
                </div>
                <Link
                  href="/recreation/map"
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900"
                >
                  Open Full Map
                </Link>
              </div>
            </div>

            <div className="mt-5 h-[520px]">
              <VisitedMap key={activeMapType} type={activeMapType} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
