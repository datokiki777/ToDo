import { useToasts } from './toasts';
import styles from './ToastHost.module.css';

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <span className={styles.message}>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.onAction?.();
                dismiss(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
