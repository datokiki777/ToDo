import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dateKey, monthGrid } from '@/core/dates';
import { useSettings } from '@/core/settings/store';
import { EmptyState } from '@/core/ui/EmptyState';
import { IconButton } from '@/core/ui/IconButton';
import { PageHeader } from '@/core/ui/PageHeader';
import { useGroups } from '@/features/groups/hooks';
import { NoteCard } from '@/features/notes/components/NoteCard';
import { useNotes } from '@/features/notes/hooks';
import { notesRepository } from '@/features/notes/repository';
import { notesByDay } from './days';
import { useCalendar } from './store';
import styles from './CalendarPage.module.css';

const MAX_DOTS = 3;

export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewMode = useSettings((s) => s.viewMode);
  const all = useNotes();
  const groups = useGroups();
  const { year, month, selected, select, shift, goToday } = useCalendar();

  const months = t('calendar.months', { returnObjects: true }) as string[];
  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];

  const days = useMemo(() => notesByDay(all ?? []), [all]);
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const groupById = useMemo(() => new Map((groups ?? []).map((g) => [g.id, g])), [groups]);
  const today = dateKey(Date.now());
  const list = days.get(selected) ?? [];

  const [, selMonth, selDay] = selected.split('-').map(Number) as [number, number, number];
  const selectedLabel = t('calendar.dayTitle', { day: selDay, month: months[selMonth - 1] });

  const create = async () => {
    const note = await notesRepository.create({ kind: 'text', date: selected });
    navigate(`/note/${note.id}`);
  };

  const actions = (
    <>
      <IconButton label={t('calendar.today')} onClick={goToday}>
        <CalendarCheck size={22} />
      </IconButton>
      <IconButton label={t('calendar.prevMonth')} onClick={() => shift(-1)}>
        <ChevronLeft size={24} />
      </IconButton>
      <IconButton label={t('calendar.nextMonth')} onClick={() => shift(1)}>
        <ChevronRight size={24} />
      </IconButton>
    </>
  );

  return (
    <>
      <PageHeader title={`${months[month]} ${year}`} actions={actions} />

      <div className={styles.weekdays} aria-hidden="true">
        {weekdays.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className={styles.grid} role="grid" aria-label={`${months[month]} ${year}`}>
        {grid.map((cell) => {
          const notes = days.get(cell.key) ?? [];
          const isSelected = cell.key === selected;
          const [, cellMonth] = cell.key.split('-').map(Number) as [number, number];
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={t('calendar.cell', { day: cell.day, month: months[cellMonth - 1], count: notes.length })}
              className={[
                styles.cell,
                cell.inMonth ? '' : styles.outside,
                isSelected ? styles.selected : '',
                cell.key === today ? styles.today : '',
              ].join(' ')}
              onClick={() => select(cell.key)}
            >
              <span className={styles.num}>{cell.day}</span>
              <span className={styles.dots} aria-hidden="true">
                {notes.slice(0, MAX_DOTS).map((n) => (
                  <i key={n.id} className={styles.dot} data-color={n.color} />
                ))}
                {notes.length > MAX_DOTS && <b className={styles.more}>+</b>}
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.panel} aria-label={selectedLabel}>
        <h2 className={styles.dayHeading}>
          {selectedLabel}
          {list.length > 0 && <span className={styles.count}>{t('calendar.notesCount', { count: list.length })}</span>}
        </h2>

        {list.length === 0 ? (
          <EmptyState icon={<CalendarDays size={28} />} title={t('calendar.empty')} hint={t('calendar.emptyHint')} />
        ) : (
          <ul className={viewMode === 'grid' ? styles.cards : styles.list}>
            {list.map((note) => (
              <li key={note.id}>
                <NoteCard
                  note={note}
                  view={viewMode}
                  group={note.groupId ? groupById.get(note.groupId) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className={styles.fab} aria-label={t('calendar.newNote')} onClick={() => void create()}>
        <Plus size={28} />
      </button>
    </>
  );
}
