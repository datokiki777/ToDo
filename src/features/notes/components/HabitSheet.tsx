import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dateKey } from '@/core/dates';
import { Sheet } from '@/core/ui/Sheet';
import { dayLabel, habitDates, MAX_HABIT_DAYS, type HabitPlan } from '../habit';
import styles from './HabitSheet.module.css';

export interface HabitValues {
  title: string;
  plan: HabitPlan;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (values: HabitValues) => void;
}

const PRESETS = [7, 14, 30, 60, 90];
/** The weekday chips start on Monday; the numbers are JavaScript's (0 = Sunday). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Make a list with one row for every day: choose what, from when, for how long, and which days to skip. */
export function HabitSheet({ open, onClose, onCreate }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(() => dateKey(Date.now()));
  const [days, setDays] = useState(30);
  const [skip, setSkip] = useState<number[]>([]);

  const months = t('calendar.months', { returnObjects: true }) as string[];
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];
  const suggestions = t('habit.suggestions', { returnObjects: true }) as string[];

  const dates = useMemo(() => habitDates({ start, days, skip }), [start, days, skip]);
  const toggle = (weekday: number) =>
    setSkip((now) => (now.includes(weekday) ? now.filter((d) => d !== weekday) : [...now, weekday]));
  const weekend = skip.includes(6) && skip.includes(0);
  const valid = title.trim() !== '' && dates.length > 0;

  const summary =
    dates.length === 0
      ? t('habit.noRows')
      : t('habit.summary', {
          rows: dates.length,
          first: dayLabel(dates[0]!, months, weekdays),
          last: dayLabel(dates.at(-1)!, months, weekdays),
        });

  return (
    <Sheet open={open} title={t('habit.title')} onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onCreate({ title: title.trim(), plan: { start, days, skip } });
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>{t('habit.name')}</span>
          <input
            className={styles.input}
            value={title}
            maxLength={80}
            placeholder={t('habit.namePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className={styles.chips}>
          {suggestions.map((s) => (
            <button key={s} type="button" className={styles.chip} onClick={() => setTitle(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t('habit.days')}</span>
          <div className={styles.chips}>
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={days === n}
                className={`${styles.chip} ${days === n ? styles.on : ''}`}
                onClick={() => setDays(n)}
              >
                {n}
              </button>
            ))}
            <input
              className={`${styles.input} ${styles.number}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_HABIT_DAYS}
              aria-label={t('habit.daysOther')}
              value={days}
              onChange={(event) => setDays(Math.min(Number(event.target.value) || 0, MAX_HABIT_DAYS))}
            />
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{t('habit.start')}</span>
          <input
            className={styles.input}
            type="date"
            value={start}
            onChange={(event) => event.target.value && setStart(event.target.value)}
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>{t('habit.skip')}</span>
          <div className={styles.chips}>
            {WEEK.map((weekday, index) => (
              <button
                key={weekday}
                type="button"
                aria-pressed={skip.includes(weekday)}
                className={`${styles.chip} ${styles.day} ${skip.includes(weekday) ? styles.skipped : ''}`}
                onClick={() => toggle(weekday)}
              >
                {weekdays[index]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.link}
            onClick={() => setSkip(weekend ? skip.filter((d) => d !== 6 && d !== 0) : [...new Set([...skip, 6, 0])])}
          >
            {weekend ? t('habit.includeWeekend') : t('habit.skipWeekend')}
          </button>
        </div>

        <p className={styles.summary} aria-live="polite">
          {summary}
        </p>
        <button type="submit" className={styles.create} disabled={!valid}>
          {t('habit.create')}
        </button>
      </form>
    </Sheet>
  );
}
