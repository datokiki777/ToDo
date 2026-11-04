import { Plus, X, RotateCcw, Trash2, GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToasts } from '@/core/ui/toasts';
import { newId } from '@/core/id';
import {
  applyItemInput,
  doneCount,
  dropIndex,
  moveItem,
  recheck,
  reinsertRows,
  removeDone,
  slideOffset,
  uncheckAll,
} from '../checklist';
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

/** The nearest ancestor that scrolls (the page itself if none does). */
function scrollParent(el: HTMLElement | null): HTMLElement {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

interface DragState {
  id: string;
  from: number;
  /** How far the dragged row is from where it started (in page coordinates, scrolling included). */
  dy: number;
  /** Where it would land if let go now. */
  target: number;
  height: number;
}

const EDGE = 72; // px from the top/bottom of the scrolling area where dragging scrolls it
const MAX_SPEED = 16; // px per frame

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

  // ---- moving rows: drag the handle (touch or mouse), or press the arrow keys on it ----
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<DragState | null>(null);
  const session = useRef<{
    pointerId: number;
    from: number;
    startY: number;
    startScroll: number;
    centers: number[];
    height: number;
    lastY: number;
    scroller: HTMLElement;
    frame: number;
  } | null>(null);
  const live = useRef({ items, onChange });
  live.current = { items, onChange };

  const measure = () => {
    const d = session.current;
    if (!d) return;
    const dy = d.lastY - d.startY + (d.scroller.scrollTop - d.startScroll);
    const draggedCenter = d.centers[d.from]! + dy;
    const target = dropIndex(d.centers, d.from, draggedCenter);
    const id = live.current.items[d.from]?.id;
    if (id) setDrag({ id, from: d.from, dy, target, height: d.height });
  };

  const autoScroll = () => {
    const d = session.current;
    if (!d) return;
    const area = d.scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : d.scroller.getBoundingClientRect();
    const speed = d.lastY < area.top + EDGE ? -Math.min(MAX_SPEED, (area.top + EDGE - d.lastY) / 4) : d.lastY > area.bottom - EDGE ? Math.min(MAX_SPEED, (d.lastY - (area.bottom - EDGE)) / 4) : 0;
    if (speed !== 0) {
      d.scroller.scrollTop += speed;
      measure();
    }
    d.frame = requestAnimationFrame(autoScroll);
  };

  const finish = (apply: boolean) => {
    const d = session.current;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    session.current = null;
    if (apply) {
      const dy = d.lastY - d.startY + (d.scroller.scrollTop - d.startScroll);
      const target = dropIndex(d.centers, d.from, d.centers[d.from]! + dy);
      if (target !== d.from) live.current.onChange(moveItem(live.current.items, d.from, target));
    }
    setDrag(null);
  };
  useEffect(() => () => cancelAnimationFrame(session.current?.frame ?? 0), []);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, index: number, item: ChecklistItem) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const scroller = scrollParent(rowEls.current.get(item.id) ?? null);
    const start = scroller.scrollTop;
    const centers = items.map((it) => {
      const rect = rowEls.current.get(it.id)!.getBoundingClientRect();
      return rect.top + rect.height / 2 + start; // page coordinates, so scrolling does not confuse them
    });
    // The centers above are relative to the scrolled content; the pointer is in screen coordinates.
    // Both are compared through the scroll offset, which is added in `measure`.
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      pointerId: event.pointerId,
      from: index,
      startY: event.clientY,
      startScroll: start,
      centers,
      height: rowEls.current.get(item.id)!.getBoundingClientRect().height,
      lastY: event.clientY,
      scroller,
      frame: requestAnimationFrame(autoScroll),
    };
    navigator.vibrate?.(8);
    setDrag({ id: item.id, from: index, dy: 0, target: index, height: session.current.height });
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const d = session.current;
    if (!d || event.pointerId !== d.pointerId) return;
    d.lastY = event.clientY;
    measure();
  };

  const handleKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null;
    if (to === null) return;
    event.preventDefault();
    if (to >= 0 && to < items.length) onChange(moveItem(items, index, to));
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

  const canMove = !readOnly && items.length > 1;
  const rowStyle = (index: number): React.CSSProperties | undefined => {
    if (!drag) return undefined;
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none' };
    const slide = slideOffset(index, drag.from, drag.target, drag.height);
    return { transform: slide ? `translateY(${slide}px)` : undefined, transition: 'transform 0.15s ease' };
  };

  return (
    <div className={styles.list}>
      {items.map((item, index) => {
        const links = rowLinks(item.text);
        return (
        <div
          key={item.id}
          ref={(el) => {
            if (el) rowEls.current.set(item.id, el);
            else rowEls.current.delete(item.id);
          }}
          className={`${styles.row} ${drag?.id === item.id ? styles.lifted : ''}`}
          data-dragging={drag?.id === item.id ? 'true' : undefined}
          style={rowStyle(index)}
        >
          {canMove && (
            <button
              type="button"
              className={styles.handle}
              aria-label={t('checklist.move')}
              title={t('checklist.move')}
              onPointerDown={(event) => startDrag(event, index, item)}
              onPointerMove={moveDrag}
              onPointerUp={() => finish(true)}
              onPointerCancel={() => finish(false)}
              onKeyDown={(event) => handleKeys(event, index)}
            >
              <GripVertical size={18} aria-hidden="true" />
            </button>
          )}
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
