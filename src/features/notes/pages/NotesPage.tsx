import { Archive, ListChecks, Plus, Search, StickyNote, Trash2, Type, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/core/settings/store';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { EmptyState } from '@/core/ui/EmptyState';
import { IconButton } from '@/core/ui/IconButton';
import { PageHeader } from '@/core/ui/PageHeader';
import { useToasts } from '@/core/ui/toasts';
import { ColorFilter } from '../components/ColorFilter';
import { ListOptionsMenu } from '../components/ListOptionsMenu';
import { NoteCard } from '../components/NoteCard';
import { useNotes } from '../hooks';
import type { NoteColor, NoteKind } from '../model';
import { notesRepository } from '../repository';
import { selectNotes, type NotesView } from '../selectors';
import styles from './NotesPage.module.css';

const COPY = {
  active: { title: 'nav.notes', empty: 'list.emptyActive', hint: 'list.emptyActiveHint' },
  archive: { title: 'nav.archive', empty: 'list.emptyArchive', hint: 'list.emptyArchiveHint' },
  trash: { title: 'nav.trash', empty: 'list.emptyTrash', hint: 'list.emptyTrashHint' },
} as const;

export function NotesPage({ mode }: { mode: NotesView }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToasts((s) => s.show);
  const all = useNotes();
  const viewMode = useSettings((s) => s.viewMode);
  const sortBy = useSettings((s) => s.sortBy);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [color, setColor] = useState<NoteColor | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  useEffect(() => {
    if (mode === 'active') void notesRepository.purgeEmpty();
  }, [mode]);

  const notes = useMemo(
    () => (all ? selectNotes(all, { view: mode, query, color, sortBy }) : null),
    [all, mode, query, color, sortBy],
  );
  const filtering = query.trim() !== '' || color !== null;
  const copy = COPY[mode];

  const create = async (kind: NoteKind) => {
    setFabOpen(false);
    const note = await notesRepository.create({ kind, color: color ?? undefined });
    navigate(`/note/${note.id}`);
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const emptyTrash = async () => {
    setConfirmEmpty(false);
    const count = await notesRepository.emptyTrash();
    showToast(t('trash.emptied', { count }));
  };

  const actions = (
    <>
      <IconButton
        label={t('list.search')}
        pressed={searching}
        onClick={() => (searching ? closeSearch() : setSearching(true))}
      >
        <Search size={22} />
      </IconButton>
      {mode === 'trash' && notes && notes.length > 0 && !filtering && (
        <IconButton label={t('trash.empty')} onClick={() => setConfirmEmpty(true)}>
          <Trash2 size={22} />
        </IconButton>
      )}
      {mode !== 'trash' && <ListOptionsMenu />}
    </>
  );

  return (
    <>
      <PageHeader title={t(copy.title)} actions={actions}>
        {searching && (
          <div className={styles.search} role="search">
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              autoFocus
              type="search"
              className={styles.input}
              value={query}
              placeholder={t('list.searchPlaceholder')}
              aria-label={t('list.search')}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && closeSearch()}
            />
            {query !== '' && (
              <button
                type="button"
                className={styles.clear}
                aria-label={t('list.clearSearch')}
                onClick={() => setQuery('')}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        {mode !== 'trash' && <ColorFilter value={color} onChange={setColor} />}
      </PageHeader>

      {notes === null ? null : notes.length === 0 ? (
        filtering ? (
          <EmptyState icon={<Search size={28} />} title={t('list.noResults')} hint={t('list.noResultsHint')} />
        ) : (
          <EmptyState
            icon={mode === 'archive' ? <Archive size={28} /> : mode === 'trash' ? <Trash2 size={28} /> : <StickyNote size={28} />}
            title={t(copy.empty)}
            hint={t(copy.hint)}
          />
        )
      ) : (
        <ul className={viewMode === 'grid' ? styles.grid : styles.list}>
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} view={viewMode} />
            </li>
          ))}
        </ul>
      )}

      {mode === 'active' && (
        <div className={styles.fabArea}>
          {fabOpen && (
            <>
              <button
                type="button"
                className={styles.scrim}
                aria-label={t('common.close')}
                onClick={() => setFabOpen(false)}
              />
              <button type="button" className={styles.pill} onClick={() => void create('checklist')}>
                <ListChecks size={20} />
                {t('list.newChecklist')}
              </button>
              <button type="button" className={styles.pill} onClick={() => void create('text')}>
                <Type size={20} />
                {t('list.newText')}
              </button>
            </>
          )}
          <button
            type="button"
            className={`${styles.fab} ${fabOpen ? styles.fabOpen : ''}`}
            aria-label={t('list.newNote')}
            aria-expanded={fabOpen}
            onClick={() => setFabOpen((v) => !v)}
          >
            <Plus size={28} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmEmpty}
        title={t('trash.confirmTitle')}
        message={t('trash.confirmBody')}
        confirmLabel={t('trash.confirmAction')}
        onConfirm={() => void emptyTrash()}
        onCancel={() => setConfirmEmpty(false)}
      />
    </>
  );
}
