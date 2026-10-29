import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
