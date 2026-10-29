import { describe, expect, it } from 'vitest';
import { asOnlyLink, extractLinks, noteLinks, textLinks } from './links';

const urls = (text: string) => extractLinks(text).map((l) => l.url);

describe('extractLinks', () => {
  it('finds addresses inside Georgian text', () => {
    expect(urls('ნახე ეს https://example.com/page და მერე დარეკე')).toEqual(['https://example.com/page']);
  });

  it('adds https to www addresses', () => {
    expect(urls('www.example.com/a')).toEqual(['https://www.example.com/a']);
  });

  it('leaves sentence punctuation out of the address', () => {
    expect(urls('იხილე https://a.com/x.')).toEqual(['https://a.com/x']);
    expect(urls('(https://a.com/x), მეორე https://b.com/y!')).toEqual(['https://a.com/x', 'https://b.com/y']);
  });

  it('keeps balanced brackets that belong to the address', () => {
    expect(urls('https://en.wikipedia.org/wiki/Tbilisi_(city)')).toEqual([
      'https://en.wikipedia.org/wiki/Tbilisi_(city)',
    ]);
  });

  it('keeps query strings and fragments', () => {
    expect(urls('https://a.com/s?q=ტესტი&x=1#top')).toEqual([expect.stringMatching(/^https:\/\/a\.com\/s\?q=/)]);
    expect(extractLinks('https://a.com/s?q=1&x=2#top')[0]?.url).toBe('https://a.com/s?q=1&x=2#top');
  });

  it('never returns non-web addresses', () => {
    expect(urls('javascript:alert(1)')).toEqual([]);
    expect(urls('mailto:a@b.com tel:+995555')).toEqual([]);
    expect(urls('ftp://files.example.com/x')).toEqual([]);
    expect(urls('გამარჯობა სამყარო')).toEqual([]);
    expect(urls('localhost:3000 and http://intranet/')).toEqual([]);
  });

  it('recognises Google Maps links, including bare short ones', () => {
    for (const text of [
      'https://maps.app.goo.gl/AbCdEf123',
      'maps.app.goo.gl/AbCdEf123',
      'https://goo.gl/maps/xyz',
      'https://www.google.com/maps/place/Tbilisi/@41.7,44.8,12z',
      'https://google.ge/maps?q=41.7,44.8',
      'https://maps.google.com/?q=41.7,44.8',
    ]) {
      const [link] = extractLinks(text);
      expect(link?.kind, text).toBe('maps');
      expect(link?.label).toBe('Google Maps');
      expect(link?.url).toMatch(/^https:\/\//);
    }
  });

  it('treats other sites as web links named by their host', () => {
    const [link] = extractLinks('https://www.youtube.com/watch?v=abc');
    expect(link).toMatchObject({ kind: 'web', label: 'youtube.com' });
    expect(link?.short).toBe('youtube.com/watch?v=abc');
    expect(extractLinks('https://www.google.com/search?q=x')[0]?.kind).toBe('web');
  });
});

describe('note links', () => {
  const note = {
    title: 'რესტორანი https://a.com',
    body: 'ლოკაცია: https://maps.app.goo.gl/x1 და ისევ https://a.com',
    items: [
      { id: '1', text: 'https://b.com/item', done: false },
      { id: '2', text: 'უბრალო', done: false },
    ],
  };

  it('collects each address once, in reading order', () => {
    expect(noteLinks(note).map((l) => l.url)).toEqual([
      'https://a.com/',
      'https://maps.app.goo.gl/x1',
      'https://b.com/item',
    ]);
  });

  it('textLinks ignores checklist rows', () => {
    expect(textLinks(note).map((l) => l.url)).toEqual(['https://a.com/', 'https://maps.app.goo.gl/x1']);
  });
});

describe('asOnlyLink', () => {
  it('describes a line that is just an address', () => {
    expect(asOnlyLink('  https://maps.app.goo.gl/x1 ')?.label).toBe('Google Maps');
    expect(asOnlyLink('https://a.com/page')?.label).toBe('a.com');
  });

  it('ignores lines with other words', () => {
    expect(asOnlyLink('ნახე https://a.com')).toBeNull();
    expect(asOnlyLink('')).toBeNull();
  });
});
