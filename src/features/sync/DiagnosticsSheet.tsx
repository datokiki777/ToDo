import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db/db';
import { formatShortDate } from '@/core/time';
import { Sheet } from '@/core/ui/Sheet';
import { useToasts } from '@/core/ui/toasts';
import { useSnapshots } from '@/features/snapshots/controller';
import { syncNow, useSync } from './controller';
import { buildReport, type ReportData } from './report';
import styles from './DiagnosticsSheet.module.css';

interface Local {
  notes: number;
  trashed: number;
  groups: number;
  tombstones: number;
  waiting: number;
  titles: Record<string, string>;
}

async function readLocal(failureIds: string[]): Promise<Local> {
  const [notes, groups, tombstones, waiting] = await Promise.all([
    db.notes.toArray(),
    db.groups.toArray(),
    db.tombstones.count(),
    db.pendingSnapshots.count(),
  ]);
  const wanted = new Set(failureIds);
  const titles: Record<string, string> = {};
  for (const n of notes) if (wanted.has(n.id)) titles[n.id] = (n.title || n.body || n.items[0]?.text || '').trim().slice(0, 40);
  for (const g of groups) if (wanted.has(g.id)) titles[g.id] = g.name.slice(0, 40);
  return {
    notes: notes.filter((n) => n.deletedAt === null).length,
    trashed: notes.filter((n) => n.deletedAt !== null).length,
    groups: groups.filter((g) => g.deletedAt === null).length,
    tombstones,
    waiting,
    titles,
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older WebViews: select the text in a hidden field and copy it.
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/** What the sync is doing and what is wrong, in plain words, with a report to paste into a chat. */
export function DiagnosticsSheet({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { status } = useSync();
  const backups = useSnapshots();
  const show = useToasts((s) => s.show);
  const failureKey = status.failures.map((f) => f.id).join(',');
  const local = useLiveQuery(
    () => (open ? readLocal(status.failures.map((f) => f.id)) : undefined),
    [open, failureKey, status.pending, status.pushed, status.pulled],
  );

  const data: ReportData | null = local
    ? {
        version: __APP_VERSION__,
        build: __APP_BUILD__,
        now: Date.now(),
        online: navigator.onLine,
        installed: window.matchMedia('(display-mode: standalone)').matches,
        language: i18n.language,
        userAgent: navigator.userAgent.replace(/\s+/g, ' ').slice(0, 160),
        schema: db.verno,
        notes: local.notes,
        trashed: local.trashed,
        groups: local.groups,
        tombstones: local.tombstones,
        sync: {
          state: status.state,
          error: status.error,
          lastSyncAt: status.lastSyncAt,
          pending: status.pending,
          pulled: status.pulled,
          pushed: status.pushed,
          conflicts: status.conflicts,
          failed: status.failed,
          failedReason: status.failedReason,
          failures: status.failures,
        },
        backups: { ready: backups.ready, waiting: local.waiting, error: backups.error },
      }
    : null;

  const copy = async () => {
    if (!data) return;
    show((await copyText(buildReport(data))) ? t('diagnostics.copied') : t('diagnostics.copyFailed'));
  };

  const row = (label: string, value: string | number) => (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <Sheet open={open} title={t('diagnostics.title')} onClose={onClose}>
      {!data || !local ? (
        <p className={styles.hint}>{t('snapshots.loading')}</p>
      ) : (
        <div className={styles.body}>
          <section>
            <h3 className={styles.heading}>{t('diagnostics.sync')}</h3>
            <dl className={styles.list}>
              {row(t('diagnostics.state'), `${status.state}${status.error ? ` · ${status.error}` : ''}`)}
              {row(
                t('diagnostics.lastSync'),
                status.lastSyncAt ? formatShortDate(status.lastSyncAt, i18n.language) : t('diagnostics.never'),
              )}
              {row(t('diagnostics.waiting'), status.pending)}
              {row(t('diagnostics.received'), status.pulled)}
              {row(t('diagnostics.sent'), status.pushed)}
              {row(t('diagnostics.conflicts'), status.conflicts)}
              {row(t('diagnostics.connection'), navigator.onLine ? t('diagnostics.online') : t('diagnostics.offline'))}
            </dl>
          </section>

          <section>
            <h3 className={styles.heading}>{t('diagnostics.failedTitle')}</h3>
            {status.failures.length === 0 ? (
              <p className={styles.good}>{t('diagnostics.noFailures')}</p>
            ) : (
              <ul className={styles.failures}>
                {status.failures.map((f) => (
                  <li key={`${f.collection}/${f.id}`}>
                    <strong>{local.titles[f.id] || t('diagnostics.untitled')}</strong>
                    <span>
                      {f.collection === 'groups' ? t('diagnostics.group') : t('diagnostics.note')} · {f.reason} ·{' '}
                      {f.bytes < 1024 ? `${f.bytes} B` : `${(f.bytes / 1024).toFixed(1)} KB`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className={styles.heading}>{t('diagnostics.data')}</h3>
            <dl className={styles.list}>
              {row(t('diagnostics.notesCount'), `${local.notes} (${t('diagnostics.inTrash')}: ${local.trashed})`)}
              {row(t('diagnostics.groupsCount'), local.groups)}
              {row(t('diagnostics.backups'), backups.ready ? t('diagnostics.ready') : t('diagnostics.notReady'))}
              {row(t('diagnostics.backupsWaiting'), local.waiting)}
              {backups.error && row(t('diagnostics.backupError'), backups.error)}
              {row(t('diagnostics.version'), `${__APP_VERSION__} · ${__APP_BUILD__}`)}
            </dl>
          </section>

          <p className={styles.hint}>{t('diagnostics.privacy')}</p>
          <div className={styles.buttons}>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => void copy()}>
              <Copy size={18} aria-hidden="true" />
              {t('diagnostics.copy')}
            </button>
            <button type="button" className={styles.button} onClick={syncNow} disabled={status.state === 'syncing'}>
              <RefreshCw size={18} aria-hidden="true" />
              {t('sync.now')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
