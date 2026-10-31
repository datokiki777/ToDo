import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatShortDate } from '@/core/time';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useToasts } from '@/core/ui/toasts';
import { resetLocalDataForCurrentAccount, syncNow, useSync } from './controller';
import styles from './SyncPanel.module.css';

function errorKey(code: string): string {
  switch (code) {
    case 'permission-denied':
      return 'sync.errorPermission';
    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
    case 'aborted':
      return 'sync.errorOffline';
    case 'resource-exhausted':
      return 'sync.errorQuota';
    case 'unauthenticated':
      return 'sync.errorAuth';
    default:
      return 'sync.errorGeneric';
  }
}

/** Shows whether this device is in step with the cloud, and what is going on if it is not. */
export function SyncPanel() {
  const { t, i18n } = useTranslation();
  const { status, follower } = useSync();
  const showToast = useToasts((s) => s.show);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (status.state === 'mismatch') {
    return (
      <div className={styles.warning} role="alert">
        <p className={styles.title}>{t('sync.mismatchTitle')}</p>
        <p>{t('sync.mismatchBody')}</p>
        <button type="button" className={styles.danger} disabled={resetting} onClick={() => setConfirmReset(true)}>
          {t('sync.mismatchReset')}
        </button>
        <ConfirmDialog
          open={confirmReset}
          title={t('sync.mismatchConfirmTitle')}
          message={t('sync.mismatchConfirmBody')}
          confirmLabel={t('sync.mismatchConfirm')}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            setResetting(true);
            void resetLocalDataForCurrentAccount()
              .catch(() => showToast(t('sync.errorGeneric', { code: 'backup' })))
              .finally(() => setResetting(false));
          }}
        />
      </div>
    );
  }

  if (follower) return <p className={styles.hint}>{t('sync.follower')}</p>;

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const label =
    status.state === 'error'
      ? t('sync.status.error')
      : offline && status.pending > 0
        ? t('sync.status.offline')
        : t(`sync.status.${status.state === 'off' ? 'starting' : status.state}`);

  return (
    <div className={styles.panel}>
      <p className={status.state === 'error' ? styles.bad : styles.status}>
        <span
          className={`${styles.dot} ${status.state === 'idle' ? styles.ok : status.state === 'error' ? styles.err : styles.busy}`}
          aria-hidden="true"
        />
        {label}
      </p>
      {status.state === 'idle' && status.lastSyncAt !== null && (
        <p className={styles.hint}>{t('sync.lastAt', { time: formatShortDate(status.lastSyncAt, i18n.language) })}</p>
      )}

      {status.state === 'error' && status.error && (
        <p className={styles.hint}>{t(errorKey(status.error), { code: status.error })}</p>
      )}
      {status.pending > 0 && <p className={styles.hint}>{t('sync.pending', { count: status.pending })}</p>}
      {(status.pulled > 0 || status.pushed > 0) && (
        <p className={styles.hint}>{t('sync.counts', { pulled: status.pulled, pushed: status.pushed })}</p>
      )}
      {status.conflicts > 0 && <p className={styles.note}>{t('sync.conflicts', { count: status.conflicts })}</p>}
      {status.failed > 0 && (
        <p className={styles.bad}>
          {status.failedReason === 'too-large'
            ? t('sync.failedTooLarge', { count: status.failed })
            : t('sync.failed', { count: status.failed, code: status.failedReason ?? 'unknown' })}
        </p>
      )}

      <button type="button" className={styles.button} onClick={syncNow} disabled={status.state === 'syncing'}>
        {t('sync.now')}
      </button>
    </div>
  );
}
