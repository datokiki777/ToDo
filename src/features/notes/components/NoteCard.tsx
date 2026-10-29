import { Link2, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatShortDate } from '@/core/time';
import type { ViewMode } from '@/core/settings/store';
import { GroupIcon } from '@/features/groups/icons';
import type { Group } from '@/features/groups/model';
import { asOnlyLink, noteLinks } from '../links';
import { checklistProgress, displayTitle, previewLines, type Note } from '../model';
import { LinkIcon } from './LinkIcon';
import styles from './NoteCard.module.css';

interface Props {
  note: Note;
  view: ViewMode;
  /** Shown as a small label; pass it only where the group isn't already obvious. */
  group?: Group;
  /** In the trash: days before it is deleted for good (shown instead of the time). */
  daysLeft?: number;
}

export function NoteCard({ note, view, group, daysLeft }: Props) {
  const { t, i18n } = useTranslation();
  const rawTitle = displayTitle(note);
  const preview = previewLines(note, 4).map((line) => asOnlyLink(line)?.short ?? line);
  const progress = note.kind === 'checklist' ? checklistProgress(note) : null;
  const links = noteLinks(note);
  const single = links.length === 1 ? links[0]! : null;

  // A note that is just an address gets the site name as its title instead of a long URL.
  let title = rawTitle;
  const onlyLink = asOnlyLink(rawTitle);
  if (onlyLink) {
    title = onlyLink.label;
    preview.unshift(onlyLink.short);
  }

  return (
    <div className={`${styles.wrap} ${single ? styles.hasOpen : ''}`} data-color={note.color}>
    <Link to={`/note/${note.id}`} className={styles.card} data-view={view}>
      <div className={styles.head}>
        <span className={styles.title}>{title || t('list.untitled')}</span>
        {note.pinned && note.deletedAt === null && (
          <Pin size={15} className={styles.pin} aria-label={t('list.pinned')} />
        )}
      </div>
      {preview.length > 0 && <p className={styles.preview}>{preview.join(' · ')}</p>}
      <div className={styles.foot}>
        {group && (
          <span className={styles.group}>
            <GroupIcon name={group.icon} size={13} />
            <span className={styles.groupName}>{group.name}</span>
          </span>
        )}
        {links.length > 1 && (
          <span className={styles.linkCount} aria-label={t('links.count', { count: links.length })}>
            <Link2 size={13} aria-hidden="true" />
            {links.length}
          </span>
        )}
        {progress && progress.total > 0 && (
          <span className={styles.progress}>
            {progress.done}/{progress.total}
          </span>
        )}
        {daysLeft !== undefined ? (
          <span className={styles.date}>{t('trash.daysLeft', { count: daysLeft })}</span>
        ) : (
          <time className={styles.date}>{formatShortDate(note.updatedAt, i18n.language)}</time>
        )}
      </div>
    </Link>
    {single && (
      <a
        className={styles.open}
        href={single.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('links.openLink', { label: single.label })}
        title={t('links.openLink', { label: single.label })}
      >
        <LinkIcon kind={single.kind} size={21} />
      </a>
    )}
    </div>
  );
}
