import { describe, expect, it } from 'vitest';
import { migrateSettings } from './store';

describe('settings saved by an older version', () => {
  it('the old "date" sort was "last changed", and keeps working as that', () => {
    expect(migrateSettings({ sortBy: 'date', theme: 'dark', viewMode: 'grid', compactCards: true }, 0)).toEqual({
      sortBy: 'modified',
      theme: 'dark',
      viewMode: 'grid',
      compactCards: true,
    });
  });

  it('a colour sort stays a colour sort', () => {
    expect(migrateSettings({ sortBy: 'color' }, 0).sortBy).toBe('color');
  });

  it('the new sorts are left alone', () => {
    expect(migrateSettings({ sortBy: 'created' }, 1).sortBy).toBe('created');
    expect(migrateSettings({ sortBy: 'modified' }, 1).sortBy).toBe('modified');
  });

  it('anything unknown or missing falls back to "last changed" instead of breaking the list', () => {
    expect(migrateSettings({ sortBy: 'alphabet' }, 0).sortBy).toBe('modified');
    expect(migrateSettings({}, 0).sortBy).toBe('modified');
    expect(migrateSettings(null, 0).sortBy).toBe('modified');
    expect(migrateSettings('nonsense', 0).sortBy).toBe('modified');
  });
});
