import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NOTE_COLORS, type NoteColor } from '../model';
import styles from './ColorPicker.module.css';

interface Props {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.row} role="radiogroup" aria-label={t('editor.color')}>
      {NOTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={t(`colors.${color}`)}
          title={t(`colors.${color}`)}
          disabled={disabled}
          className={styles.target}
          onClick={() => onChange(color)}
        >
          <span className={styles.dot} data-color={color}>
            {color === value && <Check size={16} strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  );
}
