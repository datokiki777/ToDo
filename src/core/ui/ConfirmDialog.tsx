import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ConfirmDialog.module.css';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className={`${styles.button} ${styles.danger}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
