import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TodoDB } from '@/core/db/db';
import { createGroupsRepository } from '@/features/groups/repository';
import { createNotesRepository } from '@/features/notes/repository';
import {
  backupFileName,
  BackupError,
  buildBackup,
  parseBackup,
  restoreBackup,
  type BackupRepos,
} from './backup';

function repos(prefix: string): BackupRepos {
  const db = new TodoDB(`${prefix}-${crypto.randomUUID()}`);
  return { notes: createNotesRepository(db), groups: createGroupsRepository(db) };
}

describe('backup', () => {
  it('round-trips notes and groups through a backup file', async () => {
    const source = repos('src');
    const group = await source.groups.create({ name: 'სამსახური', icon: 'building', color: 'red' });
    const n = await source.notes.create({ kind: 'checklist', color: 'purple', groupId: group.id });
    await source.notes.update(n.id, { title: 'სია', items: [{ id: 'i', text: 'პური', done: true }] });
    const trashed = await source.notes.create();
    await source.notes.update(trashed.id, { body: 'x' });
    await source.notes.moveToTrash(trashed.id);
    const removed = await source.groups.create({ name: 'gone' });
    await source.groups.remove(removed.id);

    const text = JSON.stringify(
      buildBackup(await source.notes.getAll(), await source.groups.getAllIncludingDeleted()),
    );

    const target = repos('dst');
    const result = await restoreBackup(text, target);
    expect(result).toEqual({ added: 2, updated: 0, skipped: 0, invalid: 0 });
    expect(await target.notes.getAll()).toEqual(await source.notes.getAll());
    expect(await target.groups.getAllIncludingDeleted()).toEqual(await source.groups.getAllIncludingDeleted());
    expect((await target.notes.get(n.id))?.groupId).toBe(group.id);

    // restoring the same file again changes nothing
    expect(await restoreBackup(text, target)).toMatchObject({ added: 0, updated: 0, skipped: 2 });
  });

  it('still reads version 1 backups (no groups)', async () => {
    const text = JSON.stringify({
      app: 'todo',
      formatVersion: 1,
      notes: [{ id: 'old', updatedAt: 5, title: 'ძველი', body: 'x' }],
    });
    const target = repos('v1');
    expect(await restoreBackup(text, target)).toMatchObject({ added: 1, invalid: 0 });
    expect((await target.notes.get('old'))?.groupId).toBeNull();
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

  it('counts damaged entries instead of failing the whole file', () => {
    const text = JSON.stringify({
      app: 'todo',
      formatVersion: 2,
      notes: [{ id: 'a', updatedAt: 1 }, { nope: true }, 5],
      groups: [{ id: 'g', name: 'ok', updatedAt: 1 }, { id: 'bad' }],
    });
    const parsed = parseBackup(text);
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.invalid).toBe(3);
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('todo-backup-2026-10-05.json');
  });
});
