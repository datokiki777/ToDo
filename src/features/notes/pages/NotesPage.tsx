import {
  Archive,
  FolderOpen,
  ListChecks,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/core/settings/store';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { EmptyState } from '@/core/ui/EmptyState';
import { IconButton } from '@/core/ui/IconButton';
import { PageHeader } from '@/core/ui/PageHeader';
import { useToasts } from '@/core/ui/toasts';
import { GroupSheet, type GroupValues } from '@/features/groups/components/GroupSheet';
import { GroupStrip } from '@/features/groups/components/GroupStrip';
import { useGroups } from '@/features/groups/hooks';
import type { Group } from '@/features/groups/model';
import { groupsRepository } from '@/features/groups/repository';
import { ListOptionsMenu } from '../components/ListOptionsMenu';
import { NoteCard } from '../components/NoteCard';
import { useListFilters } from '../filters';
import { useNotes } from '../hooks';
import type { NoteKind } from '../model';
import { notesRepository } from '../repository';
import { TRASH_RETENTION_DAYS, trashDaysLeft } from '../trash';
import { countNotes, selectNotes, type NotesView } from '../selectors';
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
  const groups = useGroups();
  const viewMode = useSettings((s) => s.viewMode);
  const sortBy = useSettings((s) => s.sortBy);
  const { groupId, color, setGroupId, setColor } = useListFilters();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [groupSheet, setGroupSheet] = useState<{ group: Group | null } | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);

  const inTrash = mode === 'trash';
  // A remembered group that no longer exists counts as "all". This is computed, not written back,
  // so a group that was just created can never be wrongly dropped before the list catches up.
  const groupMissing = groupId !== null && groups !== undefined && !groups.some((g) => g.id === groupId);
  const activeGroupId = inTrash || groupMissing ? null : groupId;
  const activeColor = inTrash ? null : color;
  const selectedGroup = groups?.find((g) => g.id === activeGroupId) ?? null;
  const groupById = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g])), [groups]);

  const counts = useMemo(() => (all ? countNotes(all, mode) : null), [all, mode]);
  const notes = useMemo(
    () =>
      all
        ? selectNotes(all, { view: mode, query, color: activeColor, groupId: activeGroupId, sortBy })
        : null,
    [all, mode, query, activeColor, activeGroupId, sortBy],
  );
  const searchOrColor = query.trim() !== '' || activeColor !== null;
  const copy = COPY[mode];

  const create = async (kind: NoteKind) => {
    setFabOpen(false);
    const note = await notesRepository.create({
      kind,
      color: activeColor ?? undefined,
      groupId: activeGroupId,
    });
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

  const saveGroup = async (values: GroupValues) => {
    const editing = groupSheet?.group ?? null;
    setGroupSheet(null);
    if (editing) {
      await groupsRepository.update(editing.id, values);
    } else {
      const created = await groupsRepository.create(values);
      setGroupId(created.id);
    }
  };

  const deleteGroup = async () => {
    const group = groupToDelete;
    setGroupToDelete(null);
    if (!group) return;
    await groupsRepository.remove(group.id);
    if (groupId === group.id) setGroupId(null);
    showToast(t('groups.deleted', { name: group.name }));
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
      {selectedGroup && (
        <IconButton label={t('groups.edit')} onClick={() => setGroupSheet({ group: selectedGroup })}>
          <Pencil size={21} />
        </IconButton>
      )}
      {inTrash && notes && notes.length > 0 && !searchOrColor && (
        <IconButton label={t('trash.empty')} onClick={() => setConfirmEmpty(true)}>
          <Trash2 size={22} />
        </IconButton>
      )}
      {!inTrash && <ListOptionsMenu color={color} onColorChange={setColor} />}
    </>
  );

  const emptyIcon =
    mode === 'archive' ? <Archive size={28} /> : inTrash ? <Trash2 size={28} /> : <StickyNote size={28} />;

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
        {!inTrash && groups && counts && (
          <GroupStrip
            groups={groups}
            counts={counts}
            selected={activeGroupId}
            onSelect={setGroupId}
            onAdd={() => setGroupSheet({ group: null })}
          />
        )}
      </PageHeader>

      {notes === null ? null : notes.length === 0 ? (
        searchOrColor ? (
          <EmptyState icon={<Search size={28} />} title={t('list.noResults')} hint={t('list.noResultsHint')} />
        ) : activeGroupId !== null ? (
          <EmptyState icon={<FolderOpen size={28} />} title={t('groups.empty')} hint={t('groups.emptyHint')} />
        ) : (
          <EmptyState icon={emptyIcon} title={t(copy.empty)} hint={t(copy.hint, { days: TRASH_RETENTION_DAYS })} />
        )
      ) : (
        <>
        {inTrash && <p className={styles.trashHint}>{t('trash.hint', { days: TRASH_RETENTION_DAYS })}</p>}
        <ul className={viewMode === 'grid' ? styles.grid : styles.list}>
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                view={viewMode}
                group={activeGroupId === null && note.groupId ? groupById.get(note.groupId) : undefined}
                daysLeft={inTrash && note.deletedAt !== null ? trashDaysLeft(note.deletedAt) : undefined}
              />
            </li>
          ))}
        </ul>
        </>
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

      <GroupSheet
        open={groupSheet !== null}
        group={groupSheet?.group ?? null}
        onClose={() => setGroupSheet(null)}
        onSave={saveGroup}
        onDelete={
          groupSheet?.group
            ? () => {
                setGroupToDelete(groupSheet.group);
                setGroupSheet(null);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={groupToDelete !== null}
        title={t('groups.deleteTitle', { name: groupToDelete?.name ?? '' })}
        message={t('groups.deleteBody')}
        confirmLabel={t('groups.delete')}
        onConfirm={() => void deleteGroup()}
        onCancel={() => setGroupToDelete(null)}
      />

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
