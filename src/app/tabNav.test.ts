import { describe, expect, it } from 'vitest';
import { startsOnTab, tabAction } from './tabNav';

describe('tabAction', () => {
  it('opens a tab on top of Notes with a new history entry', () => {
    expect(tabAction('/', '/calendar', false)).toEqual({ kind: 'open', to: '/calendar', replace: false });
  });

  it('switches between tabs without growing the history', () => {
    expect(tabAction('/calendar', '/trash', true)).toEqual({ kind: 'open', to: '/trash', replace: true });
  });

  it('closes the open tab when it is tapped again', () => {
    expect(tabAction('/settings', '/settings', true)).toEqual({ kind: 'close', viaBack: true });
    expect(tabAction('/trash', '/trash', false)).toEqual({ kind: 'close', viaBack: false });
  });

  it('tapping Notes while a tab is open closes it', () => {
    expect(tabAction('/calendar', '/', true)).toEqual({ kind: 'close', viaBack: true });
  });

  it('tapping Notes on Notes only scrolls to the top', () => {
    expect(tabAction('/', '/', false)).toEqual({ kind: 'scrollTop' });
  });
});

describe('startsOnTab', () => {
  it('recognises the tab addresses only', () => {
    expect(startsOnTab('#/settings')).toBe(true);
    expect(startsOnTab('#/calendar')).toBe(true);
    expect(startsOnTab('#/trash')).toBe(true);
    expect(startsOnTab('#/')).toBe(false);
    expect(startsOnTab('')).toBe(false);
    expect(startsOnTab('#/note/abc')).toBe(false);
  });
});
