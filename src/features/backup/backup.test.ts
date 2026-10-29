import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TodoDB } from '@/core/db/db';
import { createNotesRepository } from '@/features/notes/repository';
import { backupFileName, BackupError, buildBackup, parseBackup, restoreBackup } from './backup';

describe('backup', () => {
  it('round-trips notes through a backup file', async () => {
    const source = createNotesRepository(new TodoDB(`src-${crypto.randomUUID()}`));
    const n = await source.create({ kind: 'checklist', color: 'purple' });
    await source.update(n.id, { title: 'სია', items: [{ id: 'i', text: 'პური', done: true }] });
    const trashed = await source.create();
    await source.update(trashed.id, { body: 'x' });
    await source.moveToTrash(trashed.id);

    const text = JSON.stringify(buildBackup(await source.getAll()));

    const target = createNotesRepository(new TodoDB(`dst-${crypto.randomUUID()}`));
    const result = await restoreBackup(text, target);
    expect(result).toEqual({ added: 2, updated: 0, skipped: 0, invalid: 0 });
    expect(await target.getAll()).toEqual(await source.getAll());

    // restoring the same file again changes nothing
    expect(await restoreBackup(text, target)).toMatchObject({ added: 0, updated: 0, skipped: 2 });
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{oops')).toThrowError(BackupError);
    expect(() => parseBackup('[]')).toThrowError(BackupError);
    expect(() => parseBackup('{"app":"other","notes":[]}')).toThrowError(BackupError);
    try {
      parseBackup('{"app":"todo","formatVersion":99,"notes":[]}');
      expect.unreachable();
    } catch (error) {
      expect((error as BackupError).code).toBe('unsupported-version');
    }
  });

  it('counts damaged notes instead of failing the whole file', () => {
    const text = JSON.stringify({
      app: 'todo',
      formatVersion: 1,
      notes: [{ id: 'a', updatedAt: 1 }, { nope: true }, 5],
    });
    const parsed = parseBackup(text);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.invalid).toBe(2);
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('todo-backup-2026-10-05.json');
  });
});
