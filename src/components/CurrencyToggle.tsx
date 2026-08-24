'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCurrency, CURRENCIES, CurrencyCode } from '@/lib/currency-context';

export function CurrencyToggle({ inline }: { inline?: boolean } = {}) {
  const { currencyCode, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedCurrency = CURRENCIES[currencyCode];

  if (!selectedCurrency) return null;

  // ── Inline mode: render compact list embedded inside settings ──
  if (inline) {
    return (
      <div className="rounded-lg border border-[var(--op-border)] bg-[var(--op-inset)] p-1">
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
          const curr = CURRENCIES[code];
          const isSelected = currencyCode === code;

          return (
            <button
              key={code}
              type="button"
              onClick={() => setCurrency(code)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                isSelected
                  ? 'bg-[var(--op-accent)]/10 font-medium text-[var(--op-accent)]'
                  : 'text-[var(--op-sub)] hover:bg-white/[0.04] hover:text-[var(--op-text)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-4 text-center font-mono font-semibold ${isSelected ? 'text-[var(--op-accent)]' : 'text-[var(--op-dim)]'}`}>
                  {curr.symbol}
                </span>
                <span className="font-mono">{curr.code}</span>
              </div>
              {isSelected && <span className="font-mono text-[11px] text-[var(--op-accent)]">✓</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Standalone mode: trigger button + dropdown ──
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 items-center gap-1 rounded-md border border-[var(--op-border-strong)] bg-white/[0.03] px-2 font-mono text-[11px] text-[var(--op-sub)] transition-colors hover:border-[var(--op-accent)] hover:text-[var(--op-accent)]"
        title="Change Display Currency"
      >
        <span>{selectedCurrency.symbol}</span>
        <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-[var(--op-border-strong)] bg-[#0a0e15] p-1 shadow-2xl backdrop-blur-md">
          <div className="border-b border-[var(--op-border)] px-2.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--op-dim)]">
            Display Currency
          </div>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
            const curr = CURRENCIES[code];
            const isSelected = currencyCode === code;

            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setCurrency(code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                  isSelected
                    ? 'bg-[var(--op-accent)]/10 font-medium text-[var(--op-accent)]'
                    : 'text-[var(--op-sub)] hover:bg-white/[0.04] hover:text-[var(--op-text)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 text-center font-mono font-semibold ${isSelected ? 'text-[var(--op-accent)]' : 'text-[var(--op-dim)]'}`}>
                    {curr.symbol}
                  </span>
                  <span className="font-mono">{curr.code}</span>
                </div>
                {isSelected && <span className="font-mono text-[11px] text-[var(--op-accent)]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
