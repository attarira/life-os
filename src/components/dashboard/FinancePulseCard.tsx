'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { dayKey } from '@/lib/utils';
import { CardShell } from './CardShell';
import { NetWorthPoint, getNetWorthSeries, setNetWorthToday } from '@/lib/repos/networth';

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
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

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-14 w-full rounded-md bg-[var(--op-inset)]" />;
  const w = 320;
  const h = 56;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - ((p - min) / span) * (h - 8) - 4]);
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    getNetWorthSeries().then(setHistory).catch(() => {});
  }, []);

  const isDemo = history.length === 0;
  const series = useMemo(() => (isDemo ? buildDemoSeries() : history), [isDemo, history]);

  const save = async () => {
    const value = Number(draft.replace(/[^0-9.-]/g, ''));
    setEditing(false);
    setDraft('');
    if (!Number.isFinite(value)) return;
    await setNetWorthToday(value).catch(() => {});
    getNetWorthSeries().then(setHistory).catch(() => {});
  };

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
    <CardShell
      index="07"
      title="Finance Pulse"
      right={
        <div className="flex items-center gap-2">
          {isDemo && <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--op-dim)]">sample</span>}
          <button
            onClick={() => { setDraft(String(Math.round(current) || '')); setEditing(true); }}
            className="rounded-md p-1.5 text-[var(--op-dim)] transition-colors hover:bg-white/[0.04] hover:text-[var(--op-text)]"
            title="Update net worth"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      }
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--op-dim)]">Net worth</p>
      {editing ? (
        <div className="mt-1 flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="Enter net worth"
            className="w-full rounded-md border border-[var(--op-border)] bg-[var(--op-inset)] px-3 py-2 text-[15px] text-[var(--op-text)] placeholder:text-[var(--op-dim)] focus:border-[var(--op-border-strong)] focus:outline-none"
          />
          <button onClick={save} className="rounded-md border border-[var(--op-border-strong)] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--op-sub)] hover:text-[var(--op-text)]">Save</button>
        </div>
      ) : (
        <div className="mt-0.5 flex items-end justify-between gap-2">
          <span className="text-[26px] font-semibold tabular-nums tracking-tight text-[var(--op-text)]">{formatMoney(current)}</span>
          {values.length > 1 && (
            <span className={`mb-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums ${monthly >= 0 ? 'border-[var(--op-accent)]/30 text-[var(--op-accent)]' : 'border-rose-500/30 text-rose-300'}`}>
              {monthly >= 0 ? '▲' : '▼'} {Math.abs(monthlyPct).toFixed(2)}% · 30D
            </span>
          )}
        </div>
      )}

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
  );
}
