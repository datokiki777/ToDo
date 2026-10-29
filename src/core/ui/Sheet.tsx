import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';
import styles from './Sheet.module.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A panel that slides up from the bottom. Its content is created fresh every time it opens. */
export function Sheet({ open, title, onClose, children }: Props) {
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
      className={styles.sheet}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={styles.inner}>
          <div className={styles.head}>
            <h2 className={styles.title}>{title}</h2>
            <IconButton label={t('common.close')} onClick={onClose}>
              <X size={22} />
            </IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
