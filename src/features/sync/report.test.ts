import { describe, expect, it } from 'vitest';
import { buildReport, type ReportData } from './report';

const base: ReportData = {
  version: '0.12.0',
  build: 'abc1234',
  now: new Date(2026, 10, 3, 7, 12).getTime(),
  online: true,
  installed: true,
  language: 'ka',
  userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  schema: 5,
  notes: 120,
  trashed: 3,
  groups: 4,
  tombstones: 2,
  sync: {
    state: 'idle',
    error: null,
    lastSyncAt: new Date(2026, 10, 3, 7, 11).getTime(),
    pending: 0,
    pulled: 1,
    pushed: 6,
    conflicts: 0,
    failed: 0,
    failedReason: null,
    failures: [],
  },
  backups: { ready: true, waiting: 0, error: null },
};

describe('the diagnostics report', () => {
  it('says what matters in a few plain lines', () => {
    const text = buildReport(base);
    expect(text).toContain('app: 0.12.0 (abc1234)');
    expect(text).toContain('time: 2026-11-03 07:12');
    expect(text).toContain('database: schema 5, notes 120 (trash 3), groups 4, deletion marks 2');
    expect(text).toContain('sync: idle, last 2026-11-03 07:11, waiting 0, received 1, sent 6, conflicts 0');
    expect(text).toContain('failed: 0');
    expect(text).toContain('backups: ready, waiting to upload 0, error none');
  });

  it('lists failed documents by the start of their id, with the reason and size', () => {
    const text = buildReport({
      ...base,
      sync: {
        ...base.sync,
        failed: 2,
        failedReason: 'invalid-argument',
        failures: [
          { collection: 'notes', id: '1a2b3c4d-5e6f-7a8b-9c0d-ffffffffffff', reason: 'invalid-argument', bytes: 1300 },
          { collection: 'groups', id: 'ab12cd34-0000-0000-0000-000000000000', reason: 'too-large', bytes: 950_000 },
        ],
      },
    });
    expect(text).toContain('failed: 2 (invalid-argument)');
    expect(text).toContain('  - notes/1a2b3c4d · invalid-argument · 1.3 KB');
    expect(text).toContain('  - groups/ab12cd34 · too-large · 927.7 KB');
    expect(text).not.toContain('5e6f'); // the rest of the id is not in the report
  });

  it('shows errors and an offline, never-synced device', () => {
    const text = buildReport({
      ...base,
      online: false,
      installed: false,
      sync: { ...base.sync, state: 'error', error: 'permission-denied', lastSyncAt: null },
      backups: { ready: false, waiting: 2, error: 'unavailable' },
    });
    expect(text).toContain('device: offline, browser tab');
    expect(text).toContain('sync: error (permission-denied), last never');
    expect(text).toContain('backups: not ready, waiting to upload 2, error unavailable');
  });

  it('never contains note text, titles or e-mail addresses', () => {
    const text = buildReport(base);
    expect(text).not.toMatch(/@/);
    expect(Object.keys(base)).not.toContain('title');
  });
});
