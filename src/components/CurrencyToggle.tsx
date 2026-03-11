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

  // Render a stable placeholder or skeleton if context isn't ready
  if (!selectedCurrency) return null;

  // ── Inline mode: render compact list embedded in settings ──
  if (inline) {
    return (
      <div className="rounded-lg bg-slate-800/50 py-1">
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
          const curr = CURRENCIES[code];
          const isSelected = currencyCode === code;

          return (
            <button
              key={code}
              onClick={() => setCurrency(code)}
              className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors
                ${isSelected
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-4 text-center font-medium ${isSelected ? 'opacity-100' : 'opacity-60'}`}>
                  {curr.symbol}
                </span>
                <span>{curr.code}</span>
              </div>
              {isSelected && (
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
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
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 font-medium text-sm"
        title="Change Currency"
      >
        <span>{selectedCurrency.symbol}</span>
        {/* Removed extra text label for sleek minimal design */}
        <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700 py-1 z-50 overflow-hidden transform origin-top-right">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/50 mb-1">
            Display Currency
          </div>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
            const curr = CURRENCIES[code];
            const isSelected = currencyCode === code;

            return (
              <button
                key={code}
                onClick={() => {
                  setCurrency(code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors
                  ${isSelected
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-5 text-center font-medium ${isSelected ? 'opacity-100' : 'opacity-60'}`}>
                    {curr.symbol}
                  </span>
                  <span>{curr.code}</span>
                </div>
                {isSelected && (
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

