import { CalendarDays, Check, Link2, Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatDayShort, formatShortDate } from '@/core/time';
import { useToday } from '@/core/useToday';
import { useSettings, type ViewMode } from '@/core/settings/store';
import { GroupIcon } from '@/features/groups/icons';
import type { Group } from '@/features/groups/model';
import { dayDone, habitLine, isHabitNote, rowsOf, toggleDay } from '../habit';
import { linkLabel, linkTarget } from '../linkProps';
import { asOnlyLink, noteLinks } from '../links';
import { notesRepository } from '../repository';
import { checklistProgress, displayTitle, hasChecklist, previewLines, type Note } from '../model';
import { LinkIcon } from './LinkIcon';
import styles from './NoteCard.module.css';

interface Props {
  note: Note;
  view: ViewMode;
  /** Shown as a small label; pass it only where the group isn't already obvious. */
  group?: Group;
  /** In the trash: days before it is deleted for good (shown instead of the time). */
  daysLeft?: number;
  /** Which date to show: when it was last changed (usual), or when it was made. */
  showDate?: 'updated' | 'created';
}

export function NoteCard({ note, view, group, daysLeft, showDate = 'updated' }: Props) {
  const { t, i18n } = useTranslation();
  // Titles only, if chosen. Not in the trash, where the first line helps to tell notes apart.
  const compact = useSettings((s) => s.compactCards) && daysLeft === undefined;
  const rawTitle = displayTitle(note);
  // A daily list: today's row can be ticked right here, with one tap, without opening the note.
  const today = useToday();
  const habit = isHabitNote(note) && note.deletedAt === null;
  const habitToday = habit && rowsOf(note.items, today).length > 0;
  const todayDone = habitToday && dayDone(note.items, today);
  const tickToday = () => {
    const next = toggleDay(note.items, today);
    if (!next) return;
    navigator.vibrate?.(10);
    void notesRepository.update(note.id, { items: next });
  };

  const todayLine = habit ? habitLine(note.items, today) : null;
  const preview = (todayLine ? [todayLine] : previewLines(note, 4)).map((line) => asOnlyLink(line)?.short ?? line);
  const progress = hasChecklist(note) ? checklistProgress(note) : null;
  const links = noteLinks(note);
  const single = !habitToday && links.length === 1 ? links[0]! : null;

  // A note that is just an address gets the site name as its title instead of a long URL.
  let title = rawTitle;
  const onlyLink = asOnlyLink(rawTitle);
  if (onlyLink) {
    title = onlyLink.label;
    if (onlyLink.kind !== 'phone') preview.unshift(onlyLink.short); // a number needs no second line
  }

  return (
    <div className={`${styles.wrap} ${single || habitToday ? styles.hasOpen : ''} ${compact ? styles.compact : ''}`} data-color={note.color}>
    <Link to={`/note/${note.id}`} className={styles.card} data-view={view}>
      <div className={styles.head}>
        <span className={styles.title}>{title || t('list.untitled')}</span>
        {note.pinned && note.deletedAt === null && (
          <Pin size={15} className={styles.pin} aria-label={t('list.pinned')} />
        )}
      </div>
      {!compact && preview.length > 0 && <p className={styles.preview}>{preview.join(' · ')}</p>}
      <div className={styles.foot}>
        {(group || note.date) && (
          <span className={styles.tags}>
            {group && (
              <span className={styles.group}>
                <GroupIcon name={group.icon} size={13} />
                <span className={styles.groupName}>{group.name}</span>
              </span>
            )}
            {note.date && (
              <span className={styles.group}>
                <CalendarDays size={13} aria-hidden="true" />
                <span className={styles.dateText}>{formatDayShort(note.date, i18n.language)}</span>
              </span>
            )}
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
          <time className={styles.date}>
            {formatShortDate(showDate === 'created' ? note.createdAt : note.updatedAt, i18n.language)}
          </time>
        )}
      </div>
    </Link>
    {habitToday && (
      <button
        type="button"
        className={`${styles.habit} ${todayDone ? styles.habitDone : ''}`}
        aria-pressed={todayDone}
        aria-label={todayDone ? t('habit.untickToday') : t('habit.tickToday')}
        title={todayDone ? t('habit.untickToday') : t('habit.tickToday')}
        onClick={tickToday}
      >
        <Check size={22} strokeWidth={3} aria-hidden="true" />
      </button>
    )}
    {single && (
      <a
        className={styles.open}
        href={single.url}
        {...linkTarget(single)}
        aria-label={linkLabel(t, single)}
        title={linkLabel(t, single)}
      >
        <LinkIcon kind={single.kind} size={21} />
      </a>
    )}
    </div>
  );
}
