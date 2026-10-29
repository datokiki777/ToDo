import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/core/ui/Sheet';
import { ColorPicker } from '@/features/notes/components/ColorPicker';
import type { NoteColor } from '@/features/notes/model';
import { GroupIcon } from '../icons';
import {
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ICON,
  GROUP_ICONS,
  GROUP_NAME_MAX,
  normalizeGroupName,
  type Group,
  type GroupIconName,
} from '../model';
import styles from './GroupSheet.module.css';

export interface GroupValues {
  name: string;
  icon: GroupIconName;
  color: NoteColor;
}

interface Props {
  open: boolean;
  /** null = creating a new group. */
  group: Group | null;
  onClose: () => void;
  onSave: (values: GroupValues) => void | Promise<void>;
  onDelete?: () => void;
}

export function GroupSheet({ open, group, onClose, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} title={group ? t('groups.edit') : t('groups.new')} onClose={onClose}>
      <GroupForm group={group} onSave={onSave} onDelete={onDelete} />
    </Sheet>
  );
}

function GroupForm({ group, onSave, onDelete }: Pick<Props, 'group' | 'onSave' | 'onDelete'>) {
  const { t } = useTranslation();
  const [name, setName] = useState(group?.name ?? '');
  const [icon, setIcon] = useState<GroupIconName>(group?.icon ?? DEFAULT_GROUP_ICON);
  const [color, setColor] = useState<NoteColor>(group?.color ?? DEFAULT_GROUP_COLOR);
  const valid = normalizeGroupName(name) !== '';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) void onSave({ name, icon, color });
  };

  return (
    <form className={styles.form} onSubmit={submit} data-color={color}>
      <label className={styles.field}>
        <span className={styles.label}>{t('groups.name')}</span>
        <input
          className={styles.input}
          value={name}
          maxLength={GROUP_NAME_MAX}
          placeholder={t('groups.namePlaceholder')}
          autoFocus={group === null}
          enterKeyHint="done"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>{t('groups.icon')}</span>
        <div className={styles.icons} role="radiogroup" aria-label={t('groups.icon')}>
          {GROUP_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={name === icon}
              aria-label={name}
              className={`${styles.iconButton} ${name === icon ? styles.iconOn : ''}`}
              onClick={() => setIcon(name)}
            >
              <GroupIcon name={name} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('groups.color')}</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className={styles.actions}>
        {onDelete && (
          <button type="button" className={`${styles.button} ${styles.danger}`} onClick={onDelete}>
            {t('groups.delete')}
          </button>
        )}
        <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!valid}>
          {t('groups.save')}
        </button>
      </div>
    </form>
  );
}
