import { Check, FolderX, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/core/ui/Sheet';
import { GroupIcon } from '../icons';
import type { Group } from '../model';
import styles from './GroupPickerSheet.module.css';

interface Props {
  open: boolean;
  groups: Group[];
  value: string | null;
  onSelect: (groupId: string | null) => void;
  onCreate: () => void;
  onClose: () => void;
}

/** Choose which group a note belongs to. */
export function GroupPickerSheet({ open, groups, value, onSelect, onCreate, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} title={t('groups.choose')} onClose={onClose}>
      <ul className={styles.list}>
        <li>
          <button type="button" className={styles.row} aria-pressed={value === null} onClick={() => onSelect(null)}>
            <span className={styles.icon}>
              <FolderX size={20} aria-hidden="true" />
            </span>
            <span className={styles.name}>{t('groups.noGroup')}</span>
            {value === null && <Check size={20} className={styles.check} />}
          </button>
        </li>
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              className={styles.row}
              aria-pressed={value === group.id}
              onClick={() => onSelect(group.id)}
            >
              <span className={styles.icon} data-color={group.color}>
                <GroupIcon name={group.icon} />
              </span>
              <span className={styles.name}>{group.name}</span>
              {value === group.id && <Check size={20} className={styles.check} />}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={styles.row} onClick={onCreate}>
            <span className={`${styles.icon} ${styles.plus}`}>
              <Plus size={20} aria-hidden="true" />
            </span>
            <span className={styles.name}>{t('groups.new')}</span>
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
