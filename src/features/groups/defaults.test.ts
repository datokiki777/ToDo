import { describe, expect, it } from 'vitest';
import { colorForNewNote, colorWhenJoining } from './defaults';

describe('colour of a new note', () => {
  it('uses the group\'s colour when there is one', () => {
    expect(colorForNewNote(null, { noteColor: 'red' })).toBe('red');
  });
  it('a colour filter on the list wins, so the note stays visible', () => {
    expect(colorForNewNote('blue', { noteColor: 'red' })).toBe('blue');
  });
  it('falls back to nothing, so the app\'s default applies', () => {
    expect(colorForNewNote(null, { noteColor: null })).toBeUndefined();
    expect(colorForNewNote(null, null)).toBeUndefined();
  });
});

describe('colour when a note joins a group', () => {
  it('a note with nothing written takes the group\'s colour', () => {
    expect(colorWhenJoining(true, { noteColor: 'green' })).toBe('green');
  });
  it('a note with content keeps its own colour', () => {
    expect(colorWhenJoining(false, { noteColor: 'green' })).toBeUndefined();
  });
  it('a group with no preference changes nothing', () => {
    expect(colorWhenJoining(true, { noteColor: null })).toBeUndefined();
    expect(colorWhenJoining(true, null)).toBeUndefined();
  });
});
