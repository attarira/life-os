import { useState, useEffect } from 'react';
import { storage } from './utils';

export type BirthdayItem = {
  id: string;
  name: string;
  date: string; // MM-DD format
};

export const DEFAULT_BIRTHDAYS: Array<{ name: string; date: string }> = [
  { name: 'Mom', date: '03-11' },
  { name: 'Dad', date: '12-27' },
  { name: 'Sanaya', date: '12-09' },
  { name: 'Nani', date: '01-18' },
  { name: 'Adi', date: '01-18' },
  { name: 'Amaan', date: '09-15' },
  { name: 'Aamir', date: '11-02' },
  { name: 'Arman', date: '02-21' },
  { name: 'Ilhaam', date: '03-05' },
  { name: 'Abizer', date: '03-07' },
  { name: 'Mehreen', date: '03-07' },
];

const BIRTHDAYS_STORAGE_KEY = 'lifeos:birthdays:v1';

export function useBirthdays() {
  const [birthdays, setBirthdaysState] = useState<BirthdayItem[]>([]);

  useEffect(() => {
    const load = () => {
      const stored = storage.get<BirthdayItem[]>(BIRTHDAYS_STORAGE_KEY, []);
      if (stored && stored.length > 0) {
        setBirthdaysState(stored);
      } else {
        // Init with defaults
        const defaults = DEFAULT_BIRTHDAYS.map(b => ({
          id: Math.random().toString(36).substring(2, 9),
          ...b
        }));
        setBirthdaysState(defaults);
        storage.set(BIRTHDAYS_STORAGE_KEY, defaults);
      }
    };

    load();

    const handleUpdate = () => {
      load();
    };

    window.addEventListener('lifeos:birthdays-updated', handleUpdate);
    return () => window.removeEventListener('lifeos:birthdays-updated', handleUpdate);
  }, []);

  const setBirthdays = (newBirthdays: BirthdayItem[]) => {
    setBirthdaysState(newBirthdays);
    storage.set(BIRTHDAYS_STORAGE_KEY, newBirthdays);
    window.dispatchEvent(new Event('lifeos:birthdays-updated'));
  };

  const getUpcomingBirthday = (): string | null => {
    const now = new Date();
    
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayKey = `${month}-${day}`;
    
    const todayBirthdays = birthdays.filter(b => b.date === todayKey).map(b => b.name);
    if (todayBirthdays.length > 0) return todayBirthdays.join(', ');

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const monthT = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dayT = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowKey = `${monthT}-${dayT}`;
    
    const tomorrowBirthdays = birthdays.filter(b => b.date === tomorrowKey).map(b => b.name);
    if (tomorrowBirthdays.length > 0) return tomorrowBirthdays.join(', ');

    return null;
  };

  return { birthdays, setBirthdays, getUpcomingBirthday };
}
