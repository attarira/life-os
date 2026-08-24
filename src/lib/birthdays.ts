import { useState, useEffect } from 'react';
import { BirthdayItem, DEFAULT_BIRTHDAYS, listBirthdays, replaceBirthdays, migrateBirthdaysToSupabase } from './repos/birthdays';

export type { BirthdayItem };
export { DEFAULT_BIRTHDAYS, migrateBirthdaysToSupabase };

export function useBirthdays() {
  const [birthdays, setBirthdaysState] = useState<BirthdayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      setIsLoading(true);
      listBirthdays()
        .then((items) => {
          if (mounted) {
            setBirthdaysState(items);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (mounted) setIsLoading(false);
        });
    };

    load();
    window.addEventListener('lifeos:birthdays-updated', load);
    return () => {
      mounted = false;
      window.removeEventListener('lifeos:birthdays-updated', load);
    };
  }, []);

  const setBirthdays = (newBirthdays: BirthdayItem[]) => {
    setBirthdaysState(newBirthdays);
    replaceBirthdays(newBirthdays)
      .then(() => window.dispatchEvent(new Event('lifeos:birthdays-updated')))
      .catch(() => {});
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

  return { birthdays, setBirthdays, getUpcomingBirthday, isLoading };
}
