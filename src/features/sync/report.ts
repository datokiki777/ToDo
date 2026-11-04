import type { FailureInfo } from './engine';

/** Everything the diagnostics report says. Contains no note text, titles or e-mail addresses. */
export interface ReportData {
  version: string;
  build: string;
  now: number;
  online: boolean;
  installed: boolean;
  language: string;
  userAgent: string;
  schema: number;
  notes: number;
  trashed: number;
  groups: number;
  tombstones: number;
  sync: {
    state: string;
    error: string | null;
    lastSyncAt: number | null;
    pending: number;
    pulled: number;
    pushed: number;
    conflicts: number;
    failed: number;
    failedReason: string | null;
    failures: FailureInfo[];
  };
  backups: { ready: boolean; waiting: number; error: string | null };
}

const pad = (n: number) => String(n).padStart(2, '0');

function stamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function size(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * A plain-text report to paste into a chat when something is wrong. It names documents by the
 * start of their id only, so it can be shared without sharing what the notes say.
 */
export function buildReport(data: ReportData): string {
  const { sync } = data;
  const lines = [
    'ToDo diagnostics',
    `app: ${data.version} (${data.build})`,
    `time: ${stamp(data.now)}`,
    `device: ${data.online ? 'online' : 'offline'}, ${data.installed ? 'installed app' : 'browser tab'}, language ${data.language}`,
    `browser: ${data.userAgent}`,
    `database: schema ${data.schema}, notes ${data.notes} (trash ${data.trashed}), groups ${data.groups}, deletion marks ${data.tombstones}`,
    `sync: ${sync.state}${sync.error ? ` (${sync.error})` : ''}, last ${sync.lastSyncAt ? stamp(sync.lastSyncAt) : 'never'}, waiting ${sync.pending}, received ${sync.pulled}, sent ${sync.pushed}, conflicts ${sync.conflicts}`,
    `failed: ${sync.failed}${sync.failedReason ? ` (${sync.failedReason})` : ''}`,
    ...sync.failures.map((f) => `  - ${f.collection}/${f.id.slice(0, 8)} · ${f.reason} · ${size(f.bytes)}`),
    `backups: ${data.backups.ready ? 'ready' : 'not ready'}, waiting to upload ${data.backups.waiting}, error ${data.backups.error ?? 'none'}`,
  ];
  return lines.join('\n');
}
