import { ExternalLink, PhoneCall } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { linkLabel, linkTarget } from '../linkProps';
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
            {...linkTarget(link)}
            aria-label={linkLabel(t, link)}
          >
            <span className={styles.icon}>
              <LinkIcon kind={link.kind} />
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{link.label}</span>
              <span className={styles.url}>{link.kind === 'phone' ? t('links.call') : link.short}</span>
            </span>
            {link.kind === 'phone' ? (
              <PhoneCall size={18} className={styles.go} aria-hidden="true" />
            ) : (
              <ExternalLink size={18} className={styles.go} aria-hidden="true" />
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
