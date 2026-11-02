import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/core/ui/IconButton';
import { useSettings } from '@/core/settings/store';
import type { NoteColor } from '../model';
import { ColorFilter } from './ColorFilter';
import styles from './ListOptionsMenu.module.css';

interface Props {
  color: NoteColor | null;
  onColorChange: (color: NoteColor | null) => void;
}

export function ListOptionsMenu({ color, onColorChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const sortBy = useSettings((s) => s.sortBy);
  const viewMode = useSettings((s) => s.viewMode);
  const setSortBy = useSettings((s) => s.setSortBy);
  const setViewMode = useSettings((s) => s.setViewMode);
  const compact = useSettings((s) => s.compactCards);
  const setCompact = useSettings((s) => s.setCompactCards);

  const choose = (apply: () => void) => {
    apply();
    setOpen(false);
  };

  return (
    <div className={styles.wrap}>
      <IconButton
        label={t('list.sortAndView')}
        pressed={open || color !== null}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal size={22} />
      </IconButton>
      {open && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label={t('common.close')}
            onClick={() => setOpen(false)}
          />
          <div className={styles.menu} role="menu">
            <p className={styles.heading}>{t('list.filterByColor')}</p>
            <div className={styles.colors}>
              <ColorFilter value={color} onChange={onColorChange} />
            </div>
            <p className={styles.heading}>{t('list.sortBy')}</p>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={sortBy === 'modified'}
              className={styles.item}
              onClick={() => choose(() => setSortBy('modified'))}
            >
              {t('list.byModified')}
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={sortBy === 'created'}
              className={styles.item}
              onClick={() => choose(() => setSortBy('created'))}
            >
              {t('list.byCreated')}
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={sortBy === 'color'}
              className={styles.item}
              onClick={() => choose(() => setSortBy('color'))}
            >
              {t('list.byColor')}
            </button>
            <p className={styles.heading}>{t('list.view')}</p>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={viewMode === 'list'}
              className={styles.item}
              onClick={() => choose(() => setViewMode('list'))}
            >
              {t('list.viewList')}
            </button>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={viewMode === 'grid'}
              className={styles.item}
              onClick={() => choose(() => setViewMode('grid'))}
            >
              {t('list.viewGrid')}
            </button>
            <p className={styles.heading}>{t('list.cards')}</p>
            {/* stays open, so the change can be seen right behind the menu */}
            <button
              type="button"
              role="switch"
              aria-checked={compact}
              className={styles.switchRow}
              onClick={() => setCompact(!compact)}
            >
              <span className={styles.switchText}>
                <span>{t('list.compact')}</span>
                <small>{t('list.compactHint')}</small>
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.thumb} />
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
