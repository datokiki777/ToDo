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

const phones = (text: string) => extractLinks(text).filter((l) => l.kind === 'phone').map((l) => l.url);

describe('phone numbers: what is recognised', () => {
  it('Georgian mobiles, written in the usual ways', () => {
    for (const text of [
      '555123456',
      '555 12 34 56',
      '555 123 456',
      '555-12-34-56',
      '555.12.34.56',
      '+995 555 12 34 56',
      '+995555123456',
      '995 555 123 456',
      '00995 555 123456',
      '0555 123 456',
    ]) {
      expect(phones(text), text).toEqual(['tel:+995555123456']);
    }
  });

  it('Georgian landlines with the leading 0 or with the brackets', () => {
    expect(phones('032 2 12 34 56')).toEqual(['tel:+995322123456']);
    expect(phones('(032) 2 12 34 56')).toEqual(['tel:+995322123456']);
    expect(phones('+995 32 2 12 34 56')).toEqual(['tel:+995322123456']);
  });

  it('numbers from other countries, when written with a +', () => {
    expect(phones('+371 2012 3456')).toEqual(['tel:+37120123456']);
    expect(phones('+49 151 23456789')).toEqual(['tel:+4915123456789']);
    expect(phones('0049 151 23456789')).toEqual(['tel:+4915123456789']);
  });

  it('numbers inside a sentence, with Georgian text around them', () => {
    expect(phones('დარეკე გიორგის: +995 555 12 34 56, ხვალ')).toEqual(['tel:+995555123456']);
    expect(phones('ტელ:555123456.')).toEqual(['tel:+995555123456']);
    expect(phones('მისამართი\n555 12 34 56\nსხვა ხაზი')).toEqual(['tel:+995555123456']);
  });

  it('several numbers, each once, in the order written', () => {
    const body = '555 12 34 56 / 598 11 22 33, 555123456';
    expect(phones(body)).toHaveLength(3); // found three times in the text...
    expect(textLinks({ title: '', body }).map((l) => l.url)).toEqual(['tel:+995555123456', 'tel:+995598112233']); // ...listed twice
  });

  it('shows the number the way it was written', () => {
    const [link] = extractLinks('+995 555  12 34 56');
    expect(link).toMatchObject({ kind: 'phone', url: 'tel:+995555123456', label: '+995 555 12 34 56' });
  });

  it('is only ever digits and a plus in the link, so it is safe to open', () => {
    for (const link of extractLinks('+995 (555) 12-34-56 and 032 2 12 34 56')) {
      expect(link.url).toMatch(/^tel:\+\d+$/);
    }
  });
});

describe('phone numbers: what is left alone', () => {
  it('dates, times, prices and plain counts', () => {
    for (const text of ['12.05.2026', '31/10/2026', '2026-10-31', '12:30', '1 200 000', '5000.50', '100 000 ლარი', '12345678']) {
      expect(phones(text), text).toEqual([]);
    }
  });

  it('ID codes and card-like numbers that are the wrong length', () => {
    for (const text of ['01001012345', '5551234567', '1234 5678 9012 3456', '405123456789', '4051234567']) {
      expect(phones(text), text).toEqual([]);
    }
  });

  it('coordinates', () => {
    expect(phones('41.7151, 44.8271')).toEqual([]);
    expect(phones('41.715100 44.827100')).toEqual([]);
  });

  it('digits that belong to a web address', () => {
    expect(phones('https://example.com/p/555123456')).toEqual([]);
    expect(phones('https://www.google.com/maps/@41.7151,44.8271,17z')).toEqual([]);
    expect(phones('www.example.com/555123456 ან 555123456').length).toBe(1);
  });

  it('digits stuck to letters', () => {
    expect(phones('ref555123456')).toEqual([]);
    expect(phones('ABC-555123456X')).toEqual([]);
  });

  it('a plus with too few or too many digits', () => {
    expect(phones('+1 2 3')).toEqual([]);
    expect(phones('+1234567890123456789')).toEqual([]);
  });
});

describe('phone numbers inside notes', () => {
  const note = {
    title: 'კონტაქტი',
    body: 'გიორგი 555 12 34 56\nსაიტი https://a.com/1',
    items: [{ id: '1', text: 'დარეკე +995 598 11 22 33', done: false }],
  };

  it('are collected with the web addresses, once each', () => {
    expect(noteLinks(note).map((l) => l.kind)).toEqual(['phone', 'web', 'phone']);
    expect(textLinks(note).map((l) => l.kind)).toEqual(['phone', 'web']);
  });

  it('a line that is only a number is described as one', () => {
    expect(asOnlyLink(' +995 555 12 34 56 ')).toMatchObject({ kind: 'phone', url: 'tel:+995555123456' });
    expect(asOnlyLink('გიორგი 555 12 34 56')).toBeNull();
  });
});
