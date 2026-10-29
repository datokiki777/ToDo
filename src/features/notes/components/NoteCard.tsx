import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatShortDate } from '@/core/time';
import type { ViewMode } from '@/core/settings/store';
import { checklistProgress, displayTitle, previewLines, type Note } from '../model';
import styles from './NoteCard.module.css';

interface Props {
  note: Note;
  view: ViewMode;
}

export function NoteCard({ note, view }: Props) {
  const { t, i18n } = useTranslation();
  const title = displayTitle(note);
  const preview = previewLines(note, view === 'grid' ? 4 : 2);
  const progress = note.kind === 'checklist' ? checklistProgress(note) : null;

  return (
    <Link to={`/note/${note.id}`} className={styles.card} data-color={note.color} data-view={view}>
      <div className={styles.head}>
        <span className={styles.title}>{title || t('list.untitled')}</span>
        {note.pinned && note.deletedAt === null && (
          <Pin size={15} className={styles.pin} aria-label={t('list.pinned')} />
        )}
      </div>
      {preview.length > 0 && (
        <div className={styles.preview}>
          {preview.map((line, index) => (
            <p key={index} className={styles.line}>
              {line}
            </p>
          ))}
        </div>
      )}
      <div className={styles.foot}>
        {progress && progress.total > 0 && (
          <span className={styles.progress}>
            {progress.done}/{progress.total}
          </span>
        )}
        <time className={styles.date}>{formatShortDate(note.updatedAt, i18n.language)}</time>
      </div>
    </Link>
  );
}
