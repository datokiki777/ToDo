import { describe, expect, it } from 'vitest';
import type { Note } from '@/features/notes/model';
import { notesByDay } from './days';

const note = (p: Partial<Note>): Note => ({
  id: 'n',
  kind: 'text',
  title: 't',
  body: '',
  items: [],
  color: 'yellow',
  groupId: null,
  date: null,
  pinned: false,
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  ...p,
});

describe('notesByDay', () => {
  it('groups notes under their day and ignores notes with no day', () => {
    const days = notesByDay([
      note({ id: 'a', date: '2026-10-30' }),
      note({ id: 'b', date: '2026-10-30' }),
      note({ id: 'c', date: '2026-10-31' }),
      note({ id: 'd' }),
    ]);
    expect([...days.keys()].sort()).toEqual(['2026-10-30', '2026-10-31']);
    expect(days.get('2026-10-30')).toHaveLength(2);
  });

  it('leaves out trashed and blank notes', () => {
    const days = notesByDay([
      note({ id: 'gone', date: '2026-10-30', deletedAt: 5 }),
      note({ id: 'blank', date: '2026-10-30', title: '' }),
      note({ id: 'ok', date: '2026-10-30' }),
    ]);
    expect(days.get('2026-10-30')?.map((n) => n.id)).toEqual(['ok']);
  });

  it('orders a day: pinned first, then the most recently changed', () => {
    const days = notesByDay([
      note({ id: 'old', date: '2026-10-30', updatedAt: 1 }),
      note({ id: 'new', date: '2026-10-30', updatedAt: 9 }),
      note({ id: 'pin', date: '2026-10-30', updatedAt: 2, pinned: true }),
    ]);
    expect(days.get('2026-10-30')?.map((n) => n.id)).toEqual(['pin', 'new', 'old']);
  });
});
