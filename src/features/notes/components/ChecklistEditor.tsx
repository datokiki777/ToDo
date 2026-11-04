import { Plus, X, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/core/ui/toasts';
import { newId } from '@/core/id';
import { applyItemInput, doneCount, recheck, reinsertRows, removeDone, uncheckAll } from '../checklist';
import { linkLabel, linkTarget } from '../linkProps';
import { rowLinks } from '../links';
import { AutoTextarea } from './AutoTextarea';
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
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusId === null) return;
    inputs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId, items]);

  // "Undo" runs later, so it must see the rows as they are then, not as they were now.
  const latest = useRef({ items, onChange });
  latest.current = { items, onChange };
  const show = useToasts((state) => state.show);
  const ticked = doneCount(items);

  const clearTicked = () => {
    const { items: kept, removed } = removeDone(items);
    // A list is never left without a row to type into.
    const placeholder: ChecklistItem | null = kept.length === 0 ? { id: newId(), text: '', done: false } : null;
    onChange(placeholder ? [placeholder] : kept);
    show(t('checklist.clearedDone', { count: removed.length }), {
      actionLabel: t('common.undo'),
      onAction: () => {
        const now = latest.current.items.filter((item) => item.id !== placeholder?.id || item.text.trim() !== '');
        latest.current.onChange(reinsertRows(now, removed));
      },
    });
  };

  const untickAll = () => {
    const { items: cleared, changedIds } = uncheckAll(items);
    onChange(cleared);
    show(t('checklist.untickedAll', { count: changedIds.length }), {
      actionLabel: t('common.undo'),
      onAction: () => latest.current.onChange(recheck(latest.current.items, changedIds)),
    });
  };

  const patch = (id: string, changes: Partial<ChecklistItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  // Typing, Enter (a line break) and pasting several lines all arrive here.
  const type = (id: string, value: string) => {
    const result = applyItemInput(items, id, value);
    onChange(result.items);
    if (result.focusId) setFocusId(result.focusId);
  };

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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, index: number, item: ChecklistItem) => {
    if (event.key === 'Backspace' && item.text === '' && items.length > 1) {
      event.preventDefault();
      remove(index);
    }
  };

  return (
    <div className={styles.list}>
      {items.map((item, index) => {
        const links = rowLinks(item.text);
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
          <AutoTextarea
            data-field
            inputRef={(el) => {
              if (el) inputs.current.set(item.id, el);
              else inputs.current.delete(item.id);
            }}
            className={`${styles.text} ${item.done ? styles.done : ''}`}
            value={item.text}
            readOnly={readOnly}
            placeholder={t('editor.itemPlaceholder')}
            enterKeyHint="next"
            onValueChange={(value) => type(item.id, value)}
            onKeyDown={(event) => onKeyDown(event, index, item)}
          />
          {links.length > 0 && (
            <div className={styles.links}>
              {links.map((link) => (
                <a
                  key={link.url}
                  className={styles.open}
                  href={link.url}
                  {...linkTarget(link)}
                  aria-label={linkLabel(t, link)}
                  title={linkLabel(t, link)}
                >
                  <LinkIcon kind={link.kind} size={19} />
                </a>
              ))}
            </div>
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
      {!readOnly && ticked > 0 && (
        <div className={styles.bulk}>
          <button type="button" className={styles.bulkButton} onClick={clearTicked}>
            <Trash2 size={16} aria-hidden="true" />
            {t('checklist.clearDone', { count: ticked })}
          </button>
          <button type="button" className={styles.bulkButton} onClick={untickAll}>
            <RotateCcw size={16} aria-hidden="true" />
            {t('checklist.untickAll')}
          </button>
        </div>
      )}
    </div>
  );
}
