import { Ban, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NOTE_COLORS, type NoteColor } from '@/features/notes/model';
import styles from './NoteColorChoice.module.css';

interface Props {
  value: NoteColor | null;
  onChange: (color: NoteColor | null) => void;
}

/** "No preference" plus the eight colours. */
export function NoteColorChoice({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.row} role="radiogroup" aria-label={t('groups.noteColor')}>
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={t('groups.noteColorAuto')}
        title={t('groups.noteColorAuto')}
        className={styles.target}
        onClick={() => onChange(null)}
      >
        <span className={`${styles.dot} ${styles.auto} ${value === null ? styles.on : ''}`}>
          <Ban size={16} aria-hidden="true" />
        </span>
      </button>
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={t(`colors.${color}`)}
          title={t(`colors.${color}`)}
          className={styles.target}
          onClick={() => onChange(color)}
        >
          <span className={`${styles.dot} ${color === value ? styles.on : ''}`} data-color={color}>
            {color === value && <Check size={16} strokeWidth={3} aria-hidden="true" />}
          </span>
        </button>
      ))}
    </div>
  );
}
