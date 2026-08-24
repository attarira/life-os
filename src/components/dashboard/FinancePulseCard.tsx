'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { dayKey } from '@/lib/utils';
import { CardShell } from './CardShell';
import { NetWorthPoint, getNetWorthSeries } from '@/lib/repos/networth';
import { Account, listAccounts } from '@/lib/repos/accounts';

function formatMoney(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;
}

/** Deterministic sample net-worth curve shown until the user enters real data. */
function buildDemoSeries(): NetWorthPoint[] {
  const target = 2_828_350;
  const start = 2_598_000;
  const pts: NetWorthPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const base = start + (target - start) * t;
    const wobble = Math.sin(i * 1.3) * 9000 + Math.cos(i * 0.7) * 5000;
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    pts.push({ date: dayKey(d), value: Math.round(base + (i < 28 ? wobble : 0)) });
  }
  pts[0].value = start;
  pts[29].value = target;
  pts[28].value = target - 810;
  return pts;
}

function smoothSeries(values: number[], windowSize = 5): number[] {
  if (values.length <= 2) return [...values];
  const size = Math.min(windowSize, Math.max(3, Math.ceil(values.length / 8)));
  const half = Math.floor(size / 2);

  return values.map((_, index) => {
    const start = Math.max(0, index - half);
    const end = Math.min(values.length - 1, index + half);
    let sum = 0;
    let count = 0;

    for (let i = start; i <= end; i += 1) {
      sum += values[i];
      count += 1;
    }

    return sum / count;
  });
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-14 w-full rounded-md bg-[var(--op-inset)]" />;
  const smoothed = smoothSeries(points);
  const w = 320;
  const h = 56;
  const min = Math.min(...smoothed);
  const max = Math.max(...smoothed);
  const span = max - min || 1;
  const step = w / (smoothed.length - 1);
  const coords = smoothed.map((p, i) => [i * step, h - ((p - min) / span) * (h - 8) - 4]);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full">
      <defs>
        <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(63,224,161,0.30)" />
          <stop offset="100%" stopColor="rgba(63,224,161,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nw-fill)" />
      <path d={line} fill="none" stroke="var(--op-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FinancePulseCard() {
  const [history, setHistory] = useState<NetWorthPoint[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getNetWorthSeries(), listAccounts()])
      .then(([nextHistory, nextAccounts]) => {
        setHistory(nextHistory);
        setAccounts(nextAccounts);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load finance data.');
      });
  }, []);

  const accountNetWorth = useMemo(() => {
    if (accounts.length === 0) return null;
    const assets = accounts.filter((account) => account.kind === 'asset').reduce((sum, account) => sum + account.balance, 0);
    const liabilities = accounts.filter((account) => account.kind === 'liability').reduce((sum, account) => sum + account.balance, 0);
    return assets - liabilities;
  }, [accounts]);

  const isDemo = history.length === 0 && accountNetWorth === null;
  const series = useMemo(() => {
    if (history.length > 0) {
      if (accountNetWorth === null) return history;
      const today = dayKey();
      const withoutToday = history.filter((point) => point.date !== today);
      return [...withoutToday, { date: today, value: accountNetWorth }];
    }
    if (accountNetWorth !== null) return [{ date: dayKey(), value: accountNetWorth }];
    return buildDemoSeries();
  }, [accountNetWorth, history]);

  const { current, daily, dailyPct, monthly, monthlyPct, values } = useMemo(() => {
    const values = series.map((p) => p.value);
    const current = values.length ? values[values.length - 1] : 0;
    const prev = values.length > 1 ? values[values.length - 2] : current;
    const daily = current - prev;
    const dailyPct = prev ? (daily / prev) * 100 : 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = dayKey(cutoff);
    const baseline = series.find((p) => p.date >= cutoffKey)?.value ?? (values.length ? values[0] : current);
    const monthly = current - baseline;
    const monthlyPct = baseline ? (monthly / baseline) * 100 : 0;
    return { current, daily, dailyPct, monthly, monthlyPct, values };
  }, [series]);

  return (
    <Link href="/finance" className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--op-accent)]/50">
      <CardShell
        index="07"
        title="Finance Pulse"
        className="transition-colors group-hover:border-[var(--op-border-strong)]"
        right={(
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--op-dim)]">
            {isDemo ? 'sample' : 'open'}
          </span>
        )}
      >
      {error ? (
        <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>
      ) : null}
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Net worth</p>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <span className="text-[26px] font-semibold tabular-nums tracking-tight text-[var(--op-text)]">{formatMoney(current)}</span>
        {values.length > 1 && (
          <span className={`mb-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums ${monthly >= 0 ? 'border-[var(--op-accent)]/30 text-[var(--op-accent)]' : 'border-rose-500/30 text-rose-300'}`}>
            {monthly >= 0 ? '▲' : '▼'} {Math.abs(monthlyPct).toFixed(2)}% · 30D
          </span>
        )}
      </div>

      <div className="mt-3"><Sparkline points={values} /></div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--op-border)] pt-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Daily</p>
          <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${daily >= 0 ? 'text-[var(--op-accent)]' : 'text-rose-300'}`}>{formatSigned(daily)}</p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--op-muted)]">{daily >= 0 ? '+' : ''}{dailyPct.toFixed(2)}%</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Monthly</p>
          <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${monthly >= 0 ? 'text-[var(--op-accent)]' : 'text-rose-300'}`}>{formatSigned(monthly)}</p>
          <p className="font-mono text-[10px] tabular-nums text-[var(--op-muted)]">{monthly >= 0 ? '+' : ''}{monthlyPct.toFixed(2)}%</p>
        </div>
      </div>
      </CardShell>
    </Link>
  );
}
