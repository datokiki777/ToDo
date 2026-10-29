import { LayoutGrid, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteCounts } from '@/features/notes/selectors';
import { GroupIcon } from '../icons';
import type { Group } from '../model';
import styles from './GroupStrip.module.css';

interface Props {
  groups: Group[];
  counts: NoteCounts;
  selected: string | null;
  onSelect: (groupId: string | null) => void;
  onAdd: () => void;
}

/** A row of small cards, scrolling sideways: "All", then one per group, then a "+" to add one. */
export function GroupStrip({ groups, counts, selected, onSelect, onAdd }: Props) {
  const { t } = useTranslation();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <div className={styles.strip} role="group" aria-label={t('groups.title')}>
      <button
        type="button"
        ref={selected === null ? selectedRef : undefined}
        className={`${styles.card} ${selected === null ? styles.selected : ''}`}
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        <span className={styles.icon}>
          <LayoutGrid size={20} aria-hidden="true" />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{t('groups.all')}</span>
          <span className={styles.count}>{counts.total}</span>
        </span>
      </button>

      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          ref={selected === group.id ? selectedRef : undefined}
          className={`${styles.card} ${selected === group.id ? styles.selected : ''}`}
          aria-pressed={selected === group.id}
          onClick={() => onSelect(group.id)}
        >
          <span className={styles.icon} data-color={group.color}>
            <GroupIcon name={group.icon} />
          </span>
          <span className={styles.text}>
            <span className={styles.name}>{group.name}</span>
            <span className={styles.count}>{counts.byGroup.get(group.id) ?? 0}</span>
          </span>
        </button>
      ))}

      <button type="button" className={styles.add} aria-label={t('groups.new')} title={t('groups.new')} onClick={onAdd}>
        <Plus size={22} />
      </button>
    </div>
  );
}
