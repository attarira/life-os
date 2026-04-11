'use client';

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { TRAVEL_MODE_STORAGE_KEY } from './storage-keys';
import { storage } from './utils';

type TravelModeContextValue = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
};

const TravelModeContext = createContext<TravelModeContextValue | null>(null);
const TRAVEL_MODE_EVENT = 'lifeos:travel-mode-change';

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => onStoreChange();
  window.addEventListener('storage', handleChange);
  window.addEventListener(TRAVEL_MODE_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(TRAVEL_MODE_EVENT, handleChange);
  };
}

function getSnapshot() {
  return storage.get<boolean>(TRAVEL_MODE_STORAGE_KEY, false);
}

export function TravelModeProvider({ children }: { children: React.ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const value = useMemo<TravelModeContextValue>(() => ({
    enabled,
    setEnabled: (next: boolean) => {
      storage.set(TRAVEL_MODE_STORAGE_KEY, next);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(TRAVEL_MODE_EVENT));
      }
    },
  }), [enabled]);

  return (
    <TravelModeContext.Provider value={value}>
      {children}
    </TravelModeContext.Provider>
  );
}

export function useTravelMode() {
  const context = useContext(TravelModeContext);
  if (!context) {
    throw new Error('useTravelMode must be used within a TravelModeProvider');
  }
  return context;
}
