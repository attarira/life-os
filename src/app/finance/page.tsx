'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/auth/AuthGate';
import { FinanceDashboard } from '@/components/finance/FinanceDashboard';

export default function FinancePage() {
  return (
    <AuthGate>
      <div className="op min-h-screen text-[var(--op-text)]">
        <header className="border-b border-[var(--op-border)]">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--op-muted)] hover:bg-white/[0.04] hover:text-[var(--op-text)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Dashboard
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Life OS // Finance</span>
          </div>
        </header>
        <FinanceDashboard />
      </div>
    </AuthGate>
  );
}
