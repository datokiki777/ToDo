import { describe, expect, it } from 'vitest';
import { noteFromShare } from './received';

describe('a note made from something shared to the app', () => {
  it('a place from Maps: the name is the title, the link is the text', () => {
    expect(noteFromShare({ text: 'სასტუმრო თბილისი, რუსთაველი 5\nhttps://maps.app.goo.gl/AbC123' })).toEqual({
      title: 'სასტუმრო თბილისი, რუსთაველი 5',
      body: 'https://maps.app.goo.gl/AbC123',
    });
  });

  it('a web page: its title and its address', () => {
    expect(noteFromShare({ title: 'რეცეპტი', url: 'https://example.com/a' })).toEqual({
      title: 'რეცეპტი',
      body: 'https://example.com/a',
    });
  });

  it('only a link: no title, the link is the text', () => {
    expect(noteFromShare({ text: 'https://maps.app.goo.gl/AbC123' })).toEqual({ title: '', body: 'https://maps.app.goo.gl/AbC123' });
  });

  it('a phone number alone is not taken for a name', () => {
    expect(noteFromShare({ text: '+995 555 12 34 56\nhttps://a.com/x' })).toEqual({
      title: '',
      body: '+995 555 12 34 56\nhttps://a.com/x',
    });
  });

  it('plain text of one line stays as the text', () => {
    expect(noteFromShare({ text: 'გიორგი 555 12 34 56' })).toEqual({ title: '', body: 'გიორგი 555 12 34 56' });
  });

  it('several lines: the first short line is the title', () => {
    expect(noteFromShare({ text: 'საყიდლები\nპური\nრძე' })).toEqual({ title: 'საყიდლები', body: 'პური\nრძე' });
  });

  it('a long first line is a sentence, not a title', () => {
    const sentence = 'ა'.repeat(150);
    expect(noteFromShare({ text: `${sentence}\nმეორე ხაზი` })).toEqual({ title: '', body: `${sentence}\nმეორე ხაზი` });
  });

  it('the address is not added twice when the text already holds it', () => {
    const r = noteFromShare({ title: 'გვერდი', text: 'ნახე ეს https://a.com/x', url: 'https://a.com/x' });
    expect(r).toEqual({ title: 'გვერდი', body: 'ნახე ეს https://a.com/x' });
  });

  it('the title is not repeated as the first line of the text', () => {
    expect(noteFromShare({ title: 'სათაური', text: 'სათაური\nსხეული' })).toEqual({ title: 'სათაური', body: 'სხეული' });
  });

  it('a title that is just the address is dropped', () => {
    expect(noteFromShare({ title: 'https://a.com/x', url: 'https://a.com/x' })).toEqual({ title: '', body: 'https://a.com/x' });
  });

  it('Windows line breaks and stray spaces are tidied', () => {
    expect(noteFromShare({ text: '  სახელი \r\nმეორე  ' })).toEqual({ title: 'სახელი', body: 'მეორე' });
  });

  it('nothing in it, nothing made', () => {
    expect(noteFromShare({})).toBeNull();
    expect(noteFromShare({ title: '  ', text: '', url: null })).toBeNull();
  });

  it('never makes a huge note out of a huge share', () => {
    const r = noteFromShare({ title: 'ა'.repeat(1000), text: 'ბ'.repeat(100_000) });
    expect(r?.title.length).toBe(200);
    expect(r?.body.length).toBe(20_000);
  });
});
