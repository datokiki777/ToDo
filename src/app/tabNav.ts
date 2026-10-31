export type TabAction =
  | { kind: 'scrollTop' }
  /** Close the open tab and show Notes again. `viaBack` = Notes is the previous history entry. */
  | { kind: 'close'; viaBack: boolean }
  | { kind: 'open'; to: string; replace: boolean };

/**
 * What a tap on a bottom tab should do. Notes is the home screen; Calendar, Trash and Settings
 * open on top of it, and tapping the open one again closes it.
 */
export function tabAction(current: string, target: string, openedFromNotes: boolean): TabAction {
  if (target === '/' && current === '/') return { kind: 'scrollTop' };
  if (target === '/' || target === current) return { kind: 'close', viaBack: openedFromNotes };
  // From Notes a new entry is added (so "back" returns to Notes); between tabs it is replaced.
  return { kind: 'open', to: target, replace: current !== '/' };
}

const TAB_HASHES = new Set(['#/calendar', '#/trash', '#/settings']);

/** A fresh start (or reload) always begins on Notes, never on a tab left open last time. */
export function startsOnTab(hash: string): boolean {
  return TAB_HASHES.has(hash);
}
