import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title'> {
  label: string;
  pressed?: boolean;
  children: ReactNode;
}

export function IconButton({ label, pressed, children, className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={[styles.button, pressed ? styles.pressed : '', className ?? ''].join(' ')}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...rest}
    >
      {children}
    </button>
  );
}
