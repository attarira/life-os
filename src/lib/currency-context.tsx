'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from './utils';

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
  const [currencyCode, setCurrencyCodeState] = useState<CurrencyCode>('USD');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const savedDisplayCode = storage.get<string>('lifeos:currency', 'USD');
    if (savedDisplayCode && CURRENCIES[savedDisplayCode as CurrencyCode]) {
      setCurrencyCodeState(savedDisplayCode as CurrencyCode);
    }
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyCodeState(code);
    storage.set('lifeos:currency', code);
  };

  const formatAmount = (amount: number, options?: { maximumFractionDigits?: number, minimumFractionDigits?: number }) => {
    const sym = CURRENCIES[currencyCode].symbol;
    const maxDigits = options?.maximumFractionDigits ?? 2;
    const minDigits = options?.minimumFractionDigits ?? (maxDigits === 0 ? 0 : 2);

    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    });
    return `${sym}${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currencyCode: isMounted ? currencyCode : 'USD',
      currencySymbol: isMounted ? CURRENCIES[currencyCode].symbol : '$',
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
