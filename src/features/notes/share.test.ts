import { describe, expect, it, vi } from 'vitest';
import type { NoteContent } from './model';
import { noteToShare, sharePayload } from './share';

const text = (partial: Partial<NoteContent>): NoteContent => ({
  kind: 'text',
  title: '',
  body: '',
  items: [],
  ...partial,
});

describe('noteToShare', () => {
  it('puts a blank line between title and text', () => {
    expect(noteToShare(text({ title: ' რესტორანი ', body: ' ლოკაცია\nმენიუ ' }))).toEqual({
      title: 'რესტორანი',
      text: 'რესტორანი\n\nლოკაცია\nმენიუ',
    });
  });

  it('works with only a title or only text', () => {
    expect(noteToShare(text({ title: 'მხოლოდ სათაური' }))?.text).toBe('მხოლოდ სათაური');
    expect(noteToShare(text({ body: 'მხოლოდ ტექსტი\nმეორე' }))).toEqual({
      title: 'მხოლოდ ტექსტი',
      text: 'მხოლოდ ტექსტი\nმეორე',
    });
  });

  it('keeps addresses as they are, so other apps can make them tappable', () => {
    expect(noteToShare(text({ body: 'https://maps.app.goo.gl/x1' }))?.text).toBe('https://maps.app.goo.gl/x1');
  });

  it('turns a checklist into ☐ / ☑ lines and skips blank rows', () => {
    const payload = noteToShare({
      kind: 'checklist',
      title: 'საყიდლები',
      body: '',
      items: [
        { id: '1', text: 'პური', done: true },
        { id: '2', text: '  ', done: false },
        { id: '3', text: ' რძე ', done: false },
      ],
    });
    expect(payload?.text).toBe('საყიდლები\n\n☑ პური\n☐ რძე');
  });

  it('sends the text and the checklist together, each as its own block', () => {
    const payload = noteToShare({
      kind: 'text',
      title: 'სია',
      body: 'შენიშვნა',
      items: [
        { id: '1', text: 'პური', done: true },
        { id: '2', text: 'რძე', done: false },
      ],
    });
    expect(payload?.text).toBe('სია\n\nშენიშვნა\n\n☑ პური\n☐ რძე');
  });

  it('has nothing to send for a blank note', () => {
    expect(noteToShare(text({}))).toBeNull();
    expect(noteToShare({ kind: 'checklist', title: ' ', body: '', items: [{ id: '1', text: '', done: false }] })).toBeNull();
  });
});

describe('sharePayload', () => {
  const payload = { title: 'T', text: 'T\n\nbody' };

  it('uses the phone share menu when it exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await sharePayload(payload, { share, clipboard: { writeText } })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'T\n\nbody' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does nothing more when the menu is closed without choosing', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'));
    const writeText = vi.fn();
    expect(await sharePayload(payload, { share, clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the text when sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await sharePayload(payload, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('T\n\nbody');
  });

  it('copies the text when the share menu fails for another reason', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await sharePayload(payload, { share, clipboard: { writeText } })).toBe('copied');
  });

  it('reports failure when neither works', async () => {
    expect(await sharePayload(payload, {})).toBe('failed');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await sharePayload(payload, { clipboard: { writeText } })).toBe('failed');
  });
});
