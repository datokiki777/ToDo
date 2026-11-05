import { useEffect, useState } from 'react';
import { dateKey } from './dates';

/**
 * Today's date as "2026-11-03", kept right while the app stays open: it moves on at midnight and
 * is checked again whenever the app comes back to the screen.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dateKey(Date.now()));
  useEffect(() => {
    const update = () => setToday(dateKey(Date.now()));
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return today;
}
