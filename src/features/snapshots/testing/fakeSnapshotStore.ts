import type { SnapshotMeta } from '../model';
import type { SnapshotStore } from '../store';

/** An in-memory snapshot store for tests. */
export class FakeSnapshotStore implements SnapshotStore {
  metas = new Map<string, SnapshotMeta>();
  chunks = new Map<string, Uint8Array[]>();
  writes = 0;

  async list() {
    return [...this.metas.values()].map((m) => ({ ...m }));
  }
  async read(meta: SnapshotMeta) {
    const chunks = this.chunks.get(meta.id);
    if (!chunks) throw new Error('missing');
    return chunks.map((c) => c.slice());
  }
  async write(meta: SnapshotMeta, chunks: Uint8Array[]) {
    this.metas.set(meta.id, { ...meta });
    this.chunks.set(meta.id, chunks.map((c) => c.slice()));
    this.writes += 1;
  }
  async remove(metas: SnapshotMeta[]) {
    for (const meta of metas) {
      this.metas.delete(meta.id);
      this.chunks.delete(meta.id);
    }
  }
}
