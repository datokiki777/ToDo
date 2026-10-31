import { isDateKey } from '@/core/dates';
import { newId } from '@/core/id';

export const NOTE_COLORS = [
  'yellow',
  'red',
  'orange',
  'green',
  'teal',
  'blue',
  'purple',
  'gray',
] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];
export const DEFAULT_COLOR: NoteColor = 'yellow';

export type NoteKind = 'text' | 'checklist';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/**
 * A note. Sync-ready by design:
 * - `id` is a UUID,
 * - `updatedAt` decides which copy wins when two copies are merged,
 * - `deletedAt` marks trash (and later acts as a tombstone) instead of removing the record.
 * A note can hold text, a checklist, or both. `kind` is only a hint of what it was started as:
 * what is shown depends on what is inside.
 */
export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  body: string;
  items: ChecklistItem[];
  color: NoteColor;
  /** Which group the note belongs to; null = no group. */
  groupId: string | null;
  /** The calendar day the note is marked for, "2026-10-30", or null. */
  date: string | null;
  pinned: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type NoteContent = Pick<Note, 'kind' | 'title' | 'body' | 'items'>;

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value);
}

export function isNoteEmpty(note: Pick<Note, 'title' | 'body' | 'items'>): boolean {
  return (
    note.title.trim() === '' &&
    note.body.trim() === '' &&
    note.items.every((item) => item.text.trim() === '')
  );
}

export function textToItems(body: string): ChecklistItem[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((text) => ({ id: newId(), text, done: false }));
}

export function itemsToText(items: ChecklistItem[]): string {
  return items
    .map((item) => item.text.trim())
    .filter((text) => text !== '')
    .join('\n');
}

/** Does the note have any checklist rows with words in them? */
export function hasChecklist(note: Pick<Note, 'items'>): boolean {
  return note.items.some((item) => item.text.trim() !== '');
}

/**
 * The hint stored in `kind`: "checklist" only for a note that is nothing but a checklist; a note
 * with text (alone or together with a checklist) is "text"; a blank note keeps what it started as.
 */
export function deriveKind(content: NoteContent): NoteKind {
  const text = content.body.trim() !== '';
  const list = hasChecklist(content);
  if (list && !text) return 'checklist';
  if (text) return 'text';
  return content.kind;
}

/** Turn the text's lines into checklist rows (added after any rows already there). */
export function textToChecklist(content: NoteContent): NoteContent {
  return { ...content, kind: 'checklist', body: '', items: [...content.items, ...textToItems(content.body)] };
}

/** Turn the checklist rows into lines of text (added after any text already there). */
export function checklistToText(content: NoteContent): NoteContent {
  const body = [content.body.trim(), itemsToText(content.items)].filter((part) => part !== '').join('\n');
  return { ...content, kind: 'text', body, items: [] };
}

/** Switch a note between text and checklist, keeping its words. */
export function convertKind(content: NoteContent, kind: NoteKind): NoteContent {
  return kind === 'checklist' ? textToChecklist(content) : checklistToText(content);
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  );
}

/** Title shown in lists: the title, else the first line of the content. Empty string if none. */
export function displayTitle(note: Pick<Note, 'title' | 'body' | 'items'>): string {
  const title = note.title.trim();
  if (title !== '') return title;
  const fromBody = firstLine(note.body);
  if (fromBody !== '') return fromBody;
  return note.items.find((item) => item.text.trim() !== '')?.text.trim() ?? '';
}

/** Preview lines under the title (never repeats the line used as the title). */
export function previewLines(note: Note, maxLines: number): string[] {
  const hasTitle = note.title.trim() !== '';
  const lines = [
    ...note.body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
    ...note.items.map((item) => item.text.trim()).filter((text) => text !== ''),
  ];
  return (hasTitle ? lines : lines.slice(1)).slice(0, maxLines);
}

export function checklistProgress(note: Note): { done: number; total: number } {
  const items = note.items.filter((item) => item.text.trim() !== '');
  return { done: items.filter((item) => item.done).length, total: items.length };
}

export function matchesQuery(note: Note, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q === '') return true;
  const haystack = [note.title, note.body, ...note.items.map((item) => item.text)]
    .join('\n')
    .toLocaleLowerCase();
  return haystack.includes(q);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Validate and normalise an unknown value (e.g. from a backup file). Returns null if unusable. */
export function parseNote(raw: unknown): Note | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id === '') return null;
  const updatedAt = finiteNumber(r.updatedAt);
  if (updatedAt === null) return null;

  const kind: NoteKind = r.kind === 'checklist' ? 'checklist' : 'text';
  const items: ChecklistItem[] = [];
  if (Array.isArray(r.items)) {
    for (const entry of r.items) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.text !== 'string') continue;
      items.push({
        id: typeof e.id === 'string' && e.id !== '' ? e.id : newId(),
        text: e.text,
        done: e.done === true,
      });
    }
  }

  return {
    id: r.id,
    kind,
    title: typeof r.title === 'string' ? r.title : '',
    body: typeof r.body === 'string' ? r.body : '',
    items,
    color: isNoteColor(r.color) ? r.color : DEFAULT_COLOR,
    groupId: typeof r.groupId === 'string' && r.groupId !== '' ? r.groupId : null,
    date: isDateKey(r.date) ? r.date : null,
    pinned: r.pinned === true,
    archived: r.archived === true,
    createdAt: finiteNumber(r.createdAt) ?? updatedAt,
    updatedAt,
    deletedAt: finiteNumber(r.deletedAt),
  };
}

/** What gets written to the database: blank checklist rows are editing scaffolding, not content. */
export function contentForSave(content: NoteContent): NoteContent {
  const items = content.items.filter((item) => item.text.trim() !== '');
  return { ...content, kind: deriveKind({ ...content, items }), items };
}
