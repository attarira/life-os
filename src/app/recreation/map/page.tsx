'use client';

import React from 'react';
import Link from 'next/link';
import { VisitedMap } from '@/components/VisitedMap';

export default function RecreationMapPage() {
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
            <h1 className="text-2xl font-semibold text-white tracking-tight">Places I've Visited</h1>
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
