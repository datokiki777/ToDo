import { Archive, Settings, StickyNote, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

const ITEMS = [
  { to: '/', key: 'nav.notes', icon: StickyNote, end: true },
  { to: '/archive', key: 'nav.archive', icon: Archive, end: false },
  { to: '/trash', key: 'nav.trash', icon: Trash2, end: false },
  { to: '/settings', key: 'nav.settings', icon: Settings, end: false },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className={styles.nav}>
      {ITEMS.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          replace
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon size={22} aria-hidden="true" />
          <span className={styles.label}>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
