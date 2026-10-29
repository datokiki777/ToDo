import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NoteLink } from '../links';
import { LinkIcon } from './LinkIcon';
import styles from './LinkList.module.css';

/** Addresses found in a note. One tap opens the address in the browser (or the Maps app). */
export function LinkList({ links }: { links: NoteLink[] }) {
  const { t } = useTranslation();
  if (links.length === 0) return null;
  return (
    <ul className={styles.list} aria-label={t('links.title')}>
      {links.map((link) => (
        <li key={link.url}>
          <a
            className={styles.item}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('links.openLink', { label: link.label })}
          >
            <span className={styles.icon}>
              <LinkIcon kind={link.kind} />
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{link.label}</span>
              <span className={styles.url}>{link.short}</span>
            </span>
            <ExternalLink size={18} className={styles.go} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
