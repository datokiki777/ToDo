import { useTranslation } from 'react-i18next';
import { addDays, dateKey } from '@/core/dates';
import { Sheet } from '@/core/ui/Sheet';
import styles from './DateSheet.module.css';

interface Props {
  open: boolean;
  /** The note's day, or null. */
  value: string | null;
  onChange: (date: string | null) => void;
  onClose: () => void;
}

/** Choose the calendar day for a note: a quick pick, any day, or none. */
export function DateSheet({ open, value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const today = dateKey(Date.now());
  const choose = (date: string | null) => {
    onChange(date);
    onClose();
  };
  const quick = [
    { label: t('editor.dateToday'), key: today },
    { label: t('editor.dateTomorrow'), key: addDays(today, 1) },
    { label: t('editor.dateNextWeek'), key: addDays(today, 7) },
  ];

  return (
    <Sheet open={open} title={t('editor.dateTitle')} onClose={onClose}>
      <div className={styles.quick}>
        {quick.map((q) => (
          <button
            key={q.key}
            type="button"
            className={`${styles.chip} ${value === q.key ? styles.on : ''}`}
            onClick={() => choose(q.key)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{t('editor.datePick')}</span>
        <input
          className={styles.input}
          type="date"
          value={value ?? ''}
          onChange={(event) => event.target.value && choose(event.target.value)}
        />
      </label>

      {value !== null && (
        <button type="button" className={styles.clear} onClick={() => choose(null)}>
          {t('editor.dateClear')}
        </button>
      )}
    </Sheet>
  );
}
