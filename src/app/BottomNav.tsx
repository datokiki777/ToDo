import { CalendarDays, Settings, StickyNote, Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import styles from './BottomNav.module.css';
import { tabAction } from './tabNav';

const ITEMS = [
  { to: '/', key: 'nav.notes', icon: StickyNote, end: true },
  { to: '/calendar', key: 'nav.calendar', icon: CalendarDays, end: false },
  { to: '/trash', key: 'nav.trash', icon: Trash2, end: false },
  { to: '/settings', key: 'nav.settings', icon: Settings, end: false },
] as const;

interface TabState {
  fromNotes?: boolean;
}

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? null) as TabState | null;
  const fromNotes = state?.fromNotes === true;

  const onTap = (event: MouseEvent, target: string) => {
    event.preventDefault();
    const action = tabAction(location.pathname, target, fromNotes);
    switch (action.kind) {
      case 'scrollTop':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'close':
        if (action.viaBack) navigate(-1);
        else navigate('/', { replace: true });
        break;
      case 'open':
        navigate(action.to, {
          replace: action.replace,
          state: { fromNotes: action.replace ? fromNotes : true } satisfies TabState,
        });
        break;
    }
  };

  return (
    <nav className={styles.nav}>
      {ITEMS.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={(event) => onTap(event, to)}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon size={22} aria-hidden="true" />
          <span className={styles.label}>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
