import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface Props {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, actions, children }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.actions}>{actions}</div>
      </div>
      {children}
    </header>
  );
}
