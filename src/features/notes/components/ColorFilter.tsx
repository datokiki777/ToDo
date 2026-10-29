import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NOTE_COLORS, type NoteColor } from '../model';
import styles from './ColorFilter.module.css';

interface Props {
  value: NoteColor | null;
  onChange: (color: NoteColor | null) => void;
}

/** Tap a colour to show only notes of that colour; tap it again to clear. */
export function ColorFilter({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.row} role="group" aria-label={t('editor.color')}>
      <button
        type="button"
        className={styles.target}
        aria-pressed={value === null}
        aria-label={t('list.allColors')}
        title={t('list.allColors')}
        onClick={() => onChange(null)}
      >
        <span className={`${styles.dot} ${styles.all} ${value === null ? styles.on : ''}`} />
      </button>
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={styles.target}
          aria-pressed={value === color}
          aria-label={t(`colors.${color}`)}
          title={t(`colors.${color}`)}
          onClick={() => onChange(value === color ? null : color)}
        >
          <span className={`${styles.dot} ${value === color ? styles.on : ''}`} data-color={color}>
            {value === color && <Check size={14} strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  );
}
