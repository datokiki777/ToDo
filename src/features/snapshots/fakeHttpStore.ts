import type { SnapshotMeta } from './model';
import type { SnapshotStore } from './store';

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw Object.assign(new Error('request failed'), { code: 'unavailable' });
  return (await response.json()) as T;
}

/** Test build only (VITE_FAKE_AUTH=1): snapshots kept by the test server. */
export function createFakeHttpSnapshotStore(uid: string): SnapshotStore {
  const post = (path: string, body: unknown) =>
    call(`/__cloud/snap/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid, ...(body as object) }),
    });
  return {
    list: () => call<SnapshotMeta[]>(`/__cloud/snap/list?uid=${uid}`),
    async read(meta) {
      const { chunks } = await call<{ chunks: string[] }>(`/__cloud/snap/read?uid=${uid}&id=${meta.id}`);
      return chunks.map(fromBase64);
    },
    async write(meta, chunks) {
      await post('write', { meta, chunks: chunks.map(toBase64) });
    },
    async remove(metas) {
      await post('remove', { ids: metas.map((m) => m.id) });
    },
  };
}
