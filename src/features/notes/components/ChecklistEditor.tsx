import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId } from '@/core/id';
import { extractLinks } from '../links';
import { LinkIcon } from './LinkIcon';
import type { ChecklistItem } from '../model';
import styles from './ChecklistEditor.module.css';

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly: boolean;
}

export function ChecklistEditor({ items, onChange, readOnly }: Props) {
  const { t } = useTranslation();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusId === null) return;
    inputs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, items]);

  const patch = (id: string, changes: Partial<ChecklistItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  const insertAfter = (index: number) => {
    const item: ChecklistItem = { id: newId(), text: '', done: false };
    const next = [...items];
    next.splice(index + 1, 0, item);
    onChange(next);
    setFocusId(item.id);
  };

  const remove = (index: number) => {
    const neighbour = items[index - 1] ?? items[index + 1];
    onChange(items.filter((_, i) => i !== index));
    if (neighbour) setFocusId(neighbour.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number, item: ChecklistItem) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      insertAfter(index);
    } else if (event.key === 'Backspace' && item.text === '' && items.length > 1) {
      event.preventDefault();
      remove(index);
    }
  };

  return (
    <div className={styles.list}>
      {items.map((item, index) => {
        const link = extractLinks(item.text)[0];
        return (
        <div key={item.id} className={styles.row}>
          <input
            type="checkbox"
            className={styles.check}
            checked={item.done}
            disabled={readOnly}
            aria-label={t('editor.markDone')}
            onChange={(event) => patch(item.id, { done: event.target.checked })}
          />
          <input
            ref={(el) => {
              if (el) inputs.current.set(item.id, el);
              else inputs.current.delete(item.id);
            }}
            data-field
            className={`${styles.text} ${item.done ? styles.done : ''}`}
            value={item.text}
            readOnly={readOnly}
            placeholder={t('editor.itemPlaceholder')}
            enterKeyHint="next"
            onChange={(event) => patch(item.id, { text: event.target.value })}
            onKeyDown={(event) => onKeyDown(event, index, item)}
          />
          {link && (
            <a
              className={styles.open}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('links.openLink', { label: link.label })}
              title={t('links.openLink', { label: link.label })}
            >
              <LinkIcon kind={link.kind} size={19} />
            </a>
          )}
          {!readOnly && (
            <button
              type="button"
              className={styles.remove}
              aria-label={t('editor.removeItem')}
              onClick={() => remove(index)}
            >
              <X size={18} />
            </button>
          )}
        </div>
        );
      })}
      {!readOnly && (
        <button type="button" className={styles.add} onClick={() => insertAfter(items.length - 1)}>
          <Plus size={20} />
          {t('editor.addItem')}
        </button>
      )}
    </div>
  );
}
