'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, setSetting } from './repos/settings';

export const CURRENCIES = {
  USD: { symbol: '$', code: 'USD', label: 'US Dollar (USD)', rate: 1 },
  INR: { symbol: '₹', code: 'INR', label: 'Indian Rupee (INR)', rate: 83.0 },
  EUR: { symbol: '€', code: 'EUR', label: 'Euro (EUR)', rate: 0.92 },
  GBP: { symbol: '£', code: 'GBP', label: 'British Pound (GBP)', rate: 0.79 },
};

export type CurrencyCode = keyof typeof CURRENCIES;

interface CurrencyContextValue {
  currencyCode: CurrencyCode;
  currencySymbol: string;
  setCurrency: (code: CurrencyCode) => void;
  formatAmount: (amount: number, options?: { maximumFractionDigits?: number, minimumFractionDigits?: number }) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Starts at 'USD' on both server and client (no hydration mismatch), then
  // hydrates asynchronously from the store.
  const [currencyCode, setCurrencyCodeState] = useState<CurrencyCode>('USD');

  useEffect(() => {
    getSetting<string>('currency', 'lifeos:currency', 'USD')
      .then((code) => {
        if (code && CURRENCIES[code as CurrencyCode]) setCurrencyCodeState(code as CurrencyCode);
      })
      .catch(() => {});
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyCodeState(code);
    setSetting('currency', 'lifeos:currency', code).catch(() => {});
  };

  const formatAmount = (amount: number, options?: { maximumFractionDigits?: number, minimumFractionDigits?: number }) => {
    const sym = CURRENCIES[currencyCode].symbol;
    const maxDigits = options?.maximumFractionDigits ?? 2;
    const minDigits = options?.minimumFractionDigits ?? (maxDigits === 0 ? 0 : 2);

    const locale = currencyCode === 'INR' ? 'en-IN' : undefined;
    const formatted = amount.toLocaleString(locale, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    });
    return `${sym}${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currencyCode,
      currencySymbol: CURRENCIES[currencyCode].symbol,
      setCurrency,
      formatAmount,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
