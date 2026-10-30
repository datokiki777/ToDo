import type { CloudDoc, CloudStore, Collection } from './cloud';

/**
 * Test build only (VITE_FAKE_AUTH=1): a "cloud" that lives in the test server, reached by polling,
 * so two browser windows can act as two devices without Firebase.
 */
export function createFakeHttpStore(uid: string): CloudStore {
  return {
    subscribe(collection: Collection, since, onDocs) {
      let stopped = false;
      let first = true;
      let cursor = since;
      const delivered = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const poll = async () => {
        if (stopped) return;
        try {
          const response = await fetch(`/__cloud/changes?uid=${uid}&collection=${collection}&since=${cursor ?? ''}`);
          if (response.ok) {
            const all = (await response.json()) as CloudDoc[];
            const docs = all.filter((d) => !delivered.has(`${d.id}@${d.serverTime}`));
            for (const d of docs) {
              delivered.add(`${d.id}@${d.serverTime}`);
              cursor = Math.max(cursor ?? 0, d.serverTime);
            }
            if (docs.length > 0 || first) onDocs(docs);
            first = false;
          }
        } catch {
          // offline: keep trying quietly, like a real listener
        }
        if (!stopped) timer = setTimeout(() => void poll(), 300);
      };
      void poll();
      return () => {
        stopped = true;
        clearTimeout(timer);
      };
    },

    async write(items) {
      const response = await fetch('/__cloud/write', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid, items }),
      });
      if (!response.ok) throw Object.assign(new Error('write failed'), { code: 'unavailable' });
    },
  };
}
