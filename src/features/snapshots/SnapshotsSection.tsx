import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db/db';
import { checklistProgress } from '@/features/notes/model';
import { formatDay, formatShortDate } from '@/core/time';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Sheet } from '@/core/ui/Sheet';
import { useToasts } from '@/core/ui/toasts';
import { notesRepository } from '@/features/notes/repository';
import {
  listSnapshots,
  loadSnapshot,
  restoreSnapshot,
  takeSnapshotNow,
  useSnapshots,
} from './controller';
import { SNAPSHOT_KEEP, SnapshotError, type SnapshotMeta } from './model';
import { displayTitle, isNoteEmpty, type Note } from '@/features/notes/model';
import { previewRestore, restoreAsCopy, type RestorePreview } from './restore';
import styles from './SnapshotsSection.module.css';

function errorKey(error: unknown): { key: string; code: string } {
  if (error instanceof SnapshotError) return { key: 'snapshots.errorBroken', code: error.code };
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
  if (code === 'unavailable' || code === 'deadline-exceeded') return { key: 'snapshots.errorOffline', code };
  return { key: 'snapshots.errorGeneric', code };
}

/** Browse the daily snapshots and put the app back the way it was on a chosen day. */
export function SnapshotsSection() {
  const { t, i18n } = useTranslation();
  const ready = useSnapshots((s) => s.ready);
  const autoError = useSnapshots((s) => s.error);
  const waiting = useLiveQuery(() => db.pendingSnapshots.count(), []) ?? 0;
  const showToast = useToasts((s) => s.show);

  const [items, setItems] = useState<SnapshotMeta[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<{ key: string; code: string } | null>(null);
  const [open, setOpen] = useState<SnapshotMeta | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inBackup, setInBackup] = useState<Note[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const navigate = useNavigate();

  const label = (meta: SnapshotMeta) =>
    meta.kind === 'before-restore'
      ? t('snapshots.beforeRestore', { time: formatShortDate(meta.takenAt, i18n.language) })
      : formatDay(meta.date, i18n.language);

  const refresh = async () => {
    setLoading(true);
    setProblem(null);
    try {
      setItems(await listSnapshots());
    } catch (error) {
      setProblem(errorKey(error));
    } finally {
      setLoading(false);
    }
  };

  const take = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await takeSnapshotNow();
      showToast(t('snapshots.taken'));
      if (items) await refresh();
    } catch (error) {
      setProblem(errorKey(error));
    } finally {
      setBusy(false);
    }
  };

  const show = async (meta: SnapshotMeta) => {
    setOpen(meta);
    setPreview(null);
    setProblem(null);
    try {
      const data = await loadSnapshot(meta);
      setPreview(previewRestore({ notes: await notesRepository.getAll() }, data));
      setInBackup(data.notes.filter((n) => n.deletedAt === null && !isNoteEmpty(n)).sort((a, b) => b.updatedAt - a.updatedAt));
      setShowNotes(false);
    } catch (error) {
      setOpen(null);
      setProblem(errorKey(error));
    }
  };

  /** Puts one note of the backup back as a new note; the note as it is now stays as it is. */
  const copyNote = async (source: Note) => {
    if (!open) return;
    setBusy(true);
    try {
      const day = formatDay(open.date, i18n.language);
      const copy = await restoreAsCopy(db, source, t('snapshots.copyLabel', { date: day }));
      setOpen(null);
      showToast(t('snapshots.copied', { title: displayTitle(copy) }), {
        durationMs: 10_000,
        actionLabel: t('snapshots.openCopy'),
        onAction: () => navigate(`/note/${copy.id}`),
      });
    } catch (error) {
      setOpen(null);
      setProblem(errorKey(error));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (mode: 'whole' | 'missing') => {
    if (!open) return;
    setBusy(true);
    try {
      const result = await restoreSnapshot(open, mode);
      showToast(t(mode === 'whole' ? 'snapshots.restoredWhole' : 'snapshots.restoredMissing', { count: result.restored }), {
        durationMs: 8000,
      });
      setOpen(null);
      await refresh();
    } catch (error) {
      setOpen(null);
      setProblem(errorKey(error));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="snapshots-heading">
      <h2 id="snapshots-heading" className={styles.heading}>
        {t('snapshots.title')}
      </h2>
      <p className={styles.hint}>{t('snapshots.intro', { count: SNAPSHOT_KEEP })}</p>
      {waiting > 0 && <p className={styles.note}>{t('snapshots.waiting', { count: waiting })}</p>}

      <div className={styles.buttons}>
        <button type="button" className={styles.button} disabled={!ready || loading} onClick={() => void refresh()}>
          {items ? t('snapshots.refresh') : t('snapshots.show')}
        </button>
        {items && (
          <button type="button" className={styles.button} onClick={() => setItems(null)}>
            {t('snapshots.hide')}
          </button>
        )}
        <button type="button" className={styles.button} disabled={!ready || busy} onClick={() => void take()}>
          {t('snapshots.takeNow')}
        </button>
      </div>

      {autoError && (
        <p className={styles.error} role="alert">
          {t('snapshots.errorAuto', { code: autoError })}
        </p>
      )}
      {loading && <p className={styles.hint}>{t('snapshots.loading')}</p>}
      {problem && (
        <p className={styles.error} role="alert">
          {t(problem.key, { code: problem.code })}
        </p>
      )}
      {items && items.length === 0 && !loading && <p className={styles.hint}>{t('snapshots.empty')}</p>}

      {items && items.length > 0 && (
        <ul className={styles.list}>
          {items.map((meta) => (
            <li key={meta.id}>
              <button type="button" className={styles.row} onClick={() => void show(meta)}>
                <span className={styles.date}>{label(meta)}</span>
                <span className={styles.counts}>
                  {t('snapshots.counts', { notes: meta.noteCount, groups: meta.groupCount })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open !== null} title={open ? label(open) : ''} onClose={() => !busy && setOpen(null)}>
        {!preview && <p className={styles.hint}>{t('snapshots.loading')}</p>}
        {preview && (
          <div className={styles.detail}>
            <p>{t('snapshots.inSnapshot', { count: preview.inSnapshot })}</p>
            <p>{t('snapshots.now', { count: preview.now })}</p>
            <ul className={styles.changes}>
              <li>{t('snapshots.returning', { count: preview.returning })}</li>
              <li>{t('snapshots.changing', { count: preview.changing })}</li>
              <li>{t('snapshots.toTrash', { count: preview.toTrash })}</li>
            </ul>
            <p className={styles.hint}>{t('snapshots.safety')}</p>
            <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => setConfirming(true)}>
              {t('snapshots.restoreWhole')}
            </button>
            <button type="button" className={styles.button} disabled={busy} onClick={() => void restore('missing')}>
              {t('snapshots.restoreMissing')}
            </button>
            <p className={styles.hint}>{t('snapshots.restoreMissingHint')}</p>

            <button type="button" className={styles.button} aria-expanded={showNotes} onClick={() => setShowNotes((v) => !v)}>
              {t('snapshots.notesInBackup', { count: inBackup.length })}
            </button>
            {showNotes && (
              <ul className={styles.notesList}>
                {inBackup.map((n) => {
                  const progress = n.items.length > 0 ? checklistProgress(n) : null;
                  return (
                    <li key={n.id} className={styles.noteRow}>
                      <span className={styles.noteName}>
                        {displayTitle(n) || t('list.untitled')}
                        {progress && <small> · {progress.done}/{progress.total}</small>}
                      </span>
                      <button type="button" className={styles.copyButton} disabled={busy} onClick={() => void copyNote(n)}>
                        {t('snapshots.restoreCopy')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className={`${styles.button} ${styles.closeButton}`} disabled={busy} onClick={() => setOpen(null)}>
              {t('common.close')}
            </button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirming && open !== null}
        title={t('snapshots.confirmTitle', { date: open ? label(open) : '' })}
        message={t('snapshots.confirmBody')}
        confirmLabel={t('snapshots.confirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void restore('whole')}
      />
    </section>
  );
}
