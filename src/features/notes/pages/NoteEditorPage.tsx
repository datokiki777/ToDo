import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  FolderOpen,
  ListChecks,
  Pin,
  RotateCcw,
  Share2,
  Trash2,
  Type,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { newId } from '@/core/id';
import { formatDay, formatLongDate } from '@/core/time';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { IconButton } from '@/core/ui/IconButton';
import { useToasts } from '@/core/ui/toasts';
import { DateSheet } from '@/features/calendar/components/DateSheet';
import { GroupPickerSheet } from '@/features/groups/components/GroupPickerSheet';
import { GroupSheet, type GroupValues } from '@/features/groups/components/GroupSheet';
import { useGroups } from '@/features/groups/hooks';
import { GroupIcon } from '@/features/groups/icons';
import { groupsRepository } from '@/features/groups/repository';
import { AutoTextarea } from '../components/AutoTextarea';
import { ChecklistEditor } from '../components/ChecklistEditor';
import { LinkList } from '../components/LinkList';
import { textLinks } from '../links';
import { ColorPicker } from '../components/ColorPicker';
import { useNote } from '../hooks';
import {
  checklistToText,
  hasChecklist,
  isNoteEmpty,
  textToChecklist,
  type Note,
  type NoteColor,
  type NoteContent,
} from '../model';
import { notesRepository } from '../repository';
import { noteToShare, sharePayload } from '../share';
import { trashDaysLeft } from '../trash';
import { useAutosave } from '../useAutosave';
import styles from './NoteEditorPage.module.css';

/** Which parts of a note are shown: the text, the checklist, or both. */
interface Sections {
  text: boolean;
  list: boolean;
}

/** What a note shows: whatever it holds; a blank note shows what it was started as. */
function sectionsFor(content: NoteContent): Sections {
  const list = hasChecklist(content) || content.kind === 'checklist';
  const text = content.body.trim() !== '' || !list;
  return { text, list };
}

/** A visible checklist always has one empty row to type into. */
function withBlankRow(content: NoteContent, listVisible: boolean): NoteContent {
  if (listVisible && content.items.length === 0) {
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
  // Taken from the saved note, so the list settles shortly after typing stops instead of jumping.
  const links = useMemo(() => textLinks(note), [note.title, note.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sections, setSections] = useState<Sections>(() =>
    sectionsFor({ kind: note.kind, title: note.title, body: note.body, items: note.items }),
  );
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const [focusTarget, setFocusTarget] = useState<'body' | 'list' | null>(null);
  const [draft, setDraft] = useState<NoteContent>(() => {
    const start: NoteContent = { kind: note.kind, title: note.title, body: note.body, items: note.items };
    return withBlankRow(start, sectionsFor(start).list);
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sheet, setSheet] = useState<'pick' | 'create' | 'date' | null>(null);
  const groups = useGroups();
  const group = groups?.find((g) => g.id === note.groupId) ?? null;
  const startedEmpty = useMemo(() => isNoteEmpty(note), [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const autosave = useAutosave(note.id, draft, !trashed);
  const { flush } = autosave;

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

  // If this note was changed from outside (another device, via sync) while nothing new was typed
  // here, show the new text instead of the old one, so typing never overwrites it unknowingly.
  useEffect(() => {
    const incoming: NoteContent = { kind: note.kind, title: note.title, body: note.body, items: note.items };
    if (autosave.snapshotOf(incoming) === autosave.savedSnapshot()) return; // our own save, or no change
    if (autosave.hasUnsaved()) return; // the person is typing: keep their text
    autosave.rebase(incoming);
    const next = sectionsFor(incoming);
    const list = sectionsRef.current.list || next.list;
    setSections({ text: sectionsRef.current.text || next.text, list });
    setDraft(withBlankRow(incoming, list));
  }, [note.kind, note.title, note.body, note.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/', { replace: true });
  };

  const focusFirstField = () =>
    contentRef.current?.querySelector<HTMLElement>('[data-field]')?.focus();

  // Put the cursor where something was just added.
  useEffect(() => {
    if (focusTarget === null) return;
    const root = contentRef.current;
    const target =
      focusTarget === 'body'
        ? root?.querySelector<HTMLElement>('[data-body]')
        : Array.from(root?.querySelectorAll<HTMLElement>('[data-list] [data-field]') ?? []).at(-1);
    target?.focus();
    setFocusTarget(null);
  }, [focusTarget, sections]);

  const addChecklist = () => {
    setSections((s) => ({ ...s, list: true }));
    setDraft((d) => withBlankRow(d, true));
    setFocusTarget('list');
  };

  const addText = () => {
    setSections((s) => ({ ...s, text: true }));
    setFocusTarget('body');
  };

  /** Only when the note holds just one of the two: its words move into the other form. */
  const convert = () => {
    if (sections.text) {
      setDraft((d) => withBlankRow(textToChecklist(d), true));
      setSections({ text: false, list: true });
    } else {
      setDraft((d) => checklistToText(d));
      setSections({ text: true, list: false });
    }
  };

  const setDate = (date: string | null) => void notesRepository.update(note.id, { date });

  const setColor = (color: NoteColor) => void notesRepository.update(note.id, { color });

  const setGroup = (groupId: string | null) => {
    setSheet(null);
    void notesRepository.update(note.id, { groupId });
  };

  const createGroup = async (values: GroupValues) => {
    const created = await groupsRepository.create(values);
    setGroup(created.id);
  };

  // Called straight from the tap, as the phone requires for its share menu.
  const share = async () => {
    const payload = noteToShare(draft);
    if (!payload) return;
    const result = await sharePayload(payload);
    if (result === 'copied') showToast(t('share.copied'));
    if (result === 'failed') showToast(t('share.failed'));
  };

  const togglePin = () => void notesRepository.update(note.id, { pinned: !note.pinned });

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
            <IconButton label={t('editor.share')} disabled={noteToShare(draft) === null} onClick={() => void share()}>
              <Share2 size={22} />
            </IconButton>
            <IconButton
              label={note.pinned ? t('editor.unpin') : t('editor.pin')}
              pressed={note.pinned}
              onClick={togglePin}
            >
              <Pin size={22} fill={note.pinned ? 'currentColor' : 'none'} />
            </IconButton>
            {sections.text !== sections.list && (
              <IconButton label={sections.text ? t('editor.toChecklist') : t('editor.toText')} onClick={convert}>
                {sections.text ? <ListChecks size={22} /> : <Type size={22} />}
              </IconButton>
            )}
            <IconButton label={t('editor.moveToTrash')} onClick={() => void trash()}>
              <Trash2 size={22} />
            </IconButton>
          </>
        )}
      </header>

      {trashed && (
        <div className={styles.banner} role="status">
          <span className={styles.bannerText}>
            {t('trash.inTrash')}
            {note.deletedAt !== null && (
              <span className={styles.bannerSub}>{t('trash.expires', { count: trashDaysLeft(note.deletedAt) })}</span>
            )}
          </span>
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
        <div className={styles.chips}>
          <button
            type="button"
            className={styles.groupChip}
            disabled={trashed}
            aria-label={t('groups.choose')}
            onClick={() => setSheet('pick')}
          >
            {group ? <GroupIcon name={group.icon} size={16} /> : <FolderOpen size={16} aria-hidden="true" />}
            <span className={styles.groupName}>{group ? group.name : t('groups.noGroup')}</span>
            {!trashed && <ChevronDown size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={`${styles.groupChip} ${note.date ? styles.dateOn : ''}`}
            disabled={trashed}
            aria-label={t('editor.dateTitle')}
            onClick={() => setSheet('date')}
          >
            <CalendarDays size={16} aria-hidden="true" />
            <span className={styles.groupName}>
              {note.date ? formatDay(note.date, i18n.language) : t('editor.dateAdd')}
            </span>
            {!trashed && <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>
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
        <LinkList links={links} />
        {sections.text && (
          <AutoTextarea
            data-field
            data-body
            className={styles.body}
            value={draft.body}
            placeholder={t('editor.body')}
            readOnly={trashed}
            onValueChange={(body) => setDraft((d) => ({ ...d, body }))}
          />
        )}
        {sections.list && (
          <div data-list className={sections.text ? styles.listAfterText : undefined}>
            <ChecklistEditor
              items={draft.items}
              readOnly={trashed}
              onChange={(items) => setDraft((d) => ({ ...d, items }))}
            />
          </div>
        )}

        {!trashed && (!sections.text || !sections.list) && (
          <div className={styles.adders}>
            {!sections.list && (
              <button type="button" className={styles.adder} onClick={addChecklist}>
                <ListChecks size={18} aria-hidden="true" />
                {t('editor.addChecklist')}
              </button>
            )}
            {!sections.text && (
              <button type="button" className={styles.adder} onClick={addText}>
                <Type size={18} aria-hidden="true" />
                {t('editor.addText')}
              </button>
            )}
          </div>
        )}

        {/* the empty space below keeps working like part of the text: tap it to carry on typing */}
        <div
          className={styles.tapzone}
          aria-hidden="true"
          onClick={() => !trashed && sections.text && setFocusTarget('body')}
        />
      </div>

      <footer className={styles.footer}>
        <time className={styles.edited}>
          {t('editor.edited', { date: formatLongDate(note.updatedAt, i18n.language) })}
        </time>
        <ColorPicker value={note.color} onChange={setColor} disabled={trashed} />
      </footer>

      <DateSheet open={sheet === 'date'} value={note.date} onChange={setDate} onClose={() => setSheet(null)} />
      <GroupPickerSheet
        open={sheet === 'pick'}
        groups={groups ?? []}
        value={note.groupId}
        onSelect={setGroup}
        onCreate={() => setSheet('create')}
        onClose={() => setSheet(null)}
      />
      <GroupSheet
        open={sheet === 'create'}
        group={null}
        onClose={() => setSheet(null)}
        onSave={createGroup}
      />

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
