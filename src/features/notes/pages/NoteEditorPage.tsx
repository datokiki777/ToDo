import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ListChecks,
  Pin,
  RotateCcw,
  Trash2,
  Type,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { newId } from '@/core/id';
import { formatLongDate } from '@/core/time';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { IconButton } from '@/core/ui/IconButton';
import { useToasts } from '@/core/ui/toasts';
import { AutoTextarea } from '../components/AutoTextarea';
import { ChecklistEditor } from '../components/ChecklistEditor';
import { ColorPicker } from '../components/ColorPicker';
import { useNote } from '../hooks';
import { convertKind, isNoteEmpty, type Note, type NoteColor, type NoteContent } from '../model';
import { notesRepository } from '../repository';
import { useAutosave } from '../useAutosave';
import styles from './NoteEditorPage.module.css';

/** A checklist always shows one empty row to type into. */
function withBlankRow(content: NoteContent): NoteContent {
  if (content.kind === 'checklist' && content.items.length === 0) {
    return { ...content, items: [{ id: newId(), text: '', done: false }] };
  }
  return content;
}

export function NoteEditorPage() {
  const { id } = useParams();
  const note = useNote(id);
  if (note === undefined) return <div className={styles.page} />;
  if (note === null) return <Navigate to="/" replace />;
  return <Editor key={note.id} note={note} />;
}

function Editor({ note }: { note: Note }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToasts((s) => s.show);
  const contentRef = useRef<HTMLDivElement>(null);

  const trashed = note.deletedAt !== null;
  const [draft, setDraft] = useState<NoteContent>(() =>
    withBlankRow({ kind: note.kind, title: note.title, body: note.body, items: note.items }),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const startedEmpty = useMemo(() => isNoteEmpty(note), [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useAutosave(note.id, draft, !trashed);

  // When the editor closes (back button, system back, anything): wait for the final save, then
  // remove the note if it is still blank. The deferred check skips React's dev-only fake unmount.
  const mounted = useRef(false);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        if (mounted.current) return;
        void flushRef.current().then(() => notesRepository.deleteIfEmpty(note.id));
      }, 0);
    };
  }, [note.id]);

  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  };

  const focusFirstField = () =>
    contentRef.current?.querySelector<HTMLElement>('[data-field]')?.focus();

  const toggleKind = () =>
    setDraft((d) => withBlankRow(convertKind(d, d.kind === 'text' ? 'checklist' : 'text')));

  const setColor = (color: NoteColor) => void notesRepository.update(note.id, { color });

  const togglePin = () => void notesRepository.update(note.id, { pinned: !note.pinned });

  const toggleArchive = async () => {
    await flush();
    const archive = !note.archived;
    await notesRepository.setArchived(note.id, archive);
    showToast(archive ? t('editor.archived') : t('editor.unarchived'), {
      actionLabel: t('common.undo'),
      onAction: () => void notesRepository.setArchived(note.id, !archive),
    });
    goBack();
  };

  const trash = async () => {
    await flush();
    await notesRepository.moveToTrash(note.id);
    showToast(t('editor.movedToTrash'), {
      actionLabel: t('common.undo'),
      onAction: () => void notesRepository.restore(note.id),
    });
    goBack();
  };

  const restore = async () => {
    await notesRepository.restore(note.id);
    showToast(t('editor.restored'));
  };

  const deleteForever = async () => {
    setConfirmDelete(false);
    await notesRepository.deleteForever(note.id);
    // The live query now reports "missing" and the page leaves by itself.
  };

  return (
    <div className={styles.page} data-color={note.color}>
      <header className={styles.header}>
        <IconButton label={t('common.back')} onClick={goBack}>
          <ArrowLeft size={24} />
        </IconButton>
        <div className={styles.spacer} />
        {!trashed && (
          <>
            <IconButton
              label={note.pinned ? t('editor.unpin') : t('editor.pin')}
              pressed={note.pinned}
              disabled={note.archived}
              onClick={togglePin}
            >
              <Pin size={22} />
            </IconButton>
            <IconButton
              label={draft.kind === 'text' ? t('editor.toChecklist') : t('editor.toText')}
              onClick={toggleKind}
            >
              {draft.kind === 'text' ? <ListChecks size={22} /> : <Type size={22} />}
            </IconButton>
            <IconButton
              label={note.archived ? t('editor.unarchive') : t('editor.archive')}
              onClick={() => void toggleArchive()}
            >
              {note.archived ? <ArchiveRestore size={22} /> : <Archive size={22} />}
            </IconButton>
            <IconButton label={t('editor.moveToTrash')} onClick={() => void trash()}>
              <Trash2 size={22} />
            </IconButton>
          </>
        )}
      </header>

      {trashed && (
        <div className={styles.banner} role="status">
          <span className={styles.bannerText}>{t('trash.inTrash')}</span>
          <button type="button" className={styles.bannerButton} onClick={() => void restore()}>
            <RotateCcw size={18} />
            {t('trash.restore')}
          </button>
          <button
            type="button"
            className={`${styles.bannerButton} ${styles.danger}`}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={18} />
            {t('trash.deleteForever')}
          </button>
        </div>
      )}

      <div className={styles.content} ref={contentRef}>
        <AutoTextarea
          className={styles.title}
          value={draft.title}
          placeholder={t('editor.title')}
          readOnly={trashed}
          autoFocus={startedEmpty && !trashed}
          enterKeyHint="next"
          onValueChange={(title) => setDraft((d) => ({ ...d, title: title.replace(/\n/g, ' ') }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              focusFirstField();
            }
          }}
        />
        {draft.kind === 'text' ? (
          <AutoTextarea
            data-field
            className={styles.body}
            value={draft.body}
            placeholder={t('editor.body')}
            readOnly={trashed}
            onValueChange={(body) => setDraft((d) => ({ ...d, body }))}
          />
        ) : (
          <ChecklistEditor
            items={draft.items}
            readOnly={trashed}
            onChange={(items) => setDraft((d) => ({ ...d, items }))}
          />
        )}
      </div>

      <footer className={styles.footer}>
        <time className={styles.edited}>
          {t('editor.edited', { date: formatLongDate(note.updatedAt, i18n.language) })}
        </time>
        <ColorPicker value={note.color} onChange={setColor} disabled={trashed} />
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        title={t('trash.deleteForeverTitle')}
        message={t('trash.deleteForeverBody')}
        confirmLabel={t('trash.deleteForever')}
        onConfirm={() => void deleteForever()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
