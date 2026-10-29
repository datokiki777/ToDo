import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <>
      <main>
        <Outlet />
        <div style={{ height: 'calc(var(--nav-h) + var(--safe-bottom))' }} aria-hidden="true" />
      </main>
      <BottomNav />
    </>
  );
}
