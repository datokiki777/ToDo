import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodoDB } from '@/core/db/db';
import { createNotesRepository, type NotesRepository } from './repository';

let clock = 1000;
let repo: NotesRepository;

beforeEach(() => {
  clock = 1000;
  repo = createNotesRepository(new TodoDB(`test-${crypto.randomUUID()}`), () => (clock += 10));
});

describe('notes repository', () => {
  it('creates, updates and reads a note', async () => {
    const created = await repo.create({ color: 'green' });
    expect(created.color).toBe('green');
    expect(created.deletedAt).toBeNull();

    await repo.update(created.id, { title: 'სათაური', body: 'ტექსტი' });
    const read = await repo.get(created.id);
    expect(read).toMatchObject({ title: 'სათაური', body: 'ტექსტი' });
    expect(read!.updatedAt).toBeGreaterThan(created.updatedAt);
  });

  it('keeps concurrent partial updates', async () => {
    const { id } = await repo.create();
    await Promise.all([repo.update(id, { title: 'T' }), repo.update(id, { color: 'red' })]);
    expect(await repo.get(id)).toMatchObject({ title: 'T', color: 'red' });
  });

  it('moves to trash and restores', async () => {
    const { id } = await repo.create();
    await repo.moveToTrash(id);
    expect((await repo.get(id))!.deletedAt).not.toBeNull();
    await repo.restore(id);
    expect((await repo.get(id))!.deletedAt).toBeNull();
  });

  it('unpins when archiving', async () => {
    const { id } = await repo.create();
    await repo.update(id, { pinned: true });
    await repo.setArchived(id, true);
    expect(await repo.get(id)).toMatchObject({ archived: true, pinned: false });
    await repo.setArchived(id, false);
    expect((await repo.get(id))!.archived).toBe(false);
  });

  it('empties only the trash', async () => {
    const keep = await repo.create();
    await repo.update(keep.id, { body: 'keep' });
    const gone = await repo.create();
    await repo.moveToTrash(gone.id);
    expect(await repo.emptyTrash()).toBe(1);
    expect((await repo.getAll()).map((n) => n.id)).toEqual([keep.id]);
  });

  it('purges blank notes but keeps written ones', async () => {
    const blank = await repo.create();
    const written = await repo.create();
    await repo.update(written.id, { title: 'x' });
    expect(await repo.purgeEmpty()).toBe(1);
    expect(await repo.get(blank.id)).toBeUndefined();
    expect(await repo.get(written.id)).toBeDefined();
  });

  it('merges imports: newer wins, older is skipped, unknown is added', async () => {
    const local = await repo.create();
    await repo.update(local.id, { title: 'local' });
    const current = (await repo.get(local.id))!;

    const result = await repo.importMany([
      { ...current, title: 'older', updatedAt: current.updatedAt - 1 },
      { ...current, id: 'new-1', title: 'brand new' },
    ]);
    expect(result).toEqual({ added: 1, updated: 0, skipped: 1 });
    expect((await repo.get(local.id))!.title).toBe('local');

    const newer = await repo.importMany([{ ...current, title: 'newer', updatedAt: current.updatedAt + 5 }]);
    expect(newer).toEqual({ added: 0, updated: 1, skipped: 0 });
    expect((await repo.get(local.id))!.title).toBe('newer');
  });
});
