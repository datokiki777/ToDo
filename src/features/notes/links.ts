import type { Note } from './model';

export type LinkKind = 'maps' | 'web' | 'phone';

export interface NoteLink {
  /** A full http(s) address, or "tel:+995..." for a phone number. Safe to put in an <a href>. */
  url: string;
  kind: LinkKind;
  /** "Google Maps" for map links, the site name for web links, the number as written for phones. */
  label: string;
  /** A short readable form of the address, for lists. */
  short: string;
}

// http(s) addresses, "www." addresses, and the bare short forms Google Maps shares.
const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[^\s<>"'`]+/gi;

const OPENING: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/** Remove punctuation that belongs to the sentence, not the address ("see https://a.com/x."). */
function trimTrailing(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url.at(-1);
    if (last === undefined) return url;
    if (/[.,;:!?'"»”’…]/.test(last)) {
      url = url.slice(0, -1);
      continue;
    }
    const opener = OPENING[last];
    if (opener !== undefined) {
      const opens = url.split(opener).length - 1;
      const closes = url.split(last).length - 1;
      if (closes > opens) {
        url = url.slice(0, -1);
        continue;
      }
    }
    return url;
  }
}

function toHttpUrl(raw: string): URL | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

function isMapsUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'maps.app.goo.gl' || host === 'maps.google.com') return true;
  if (host === 'goo.gl' && url.pathname.startsWith('/maps')) return true;
  return /^google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps');
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function describe(url: URL): NoteLink {
  const maps = isMapsUrl(url);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = `${url.pathname}${url.search}`.replace(/\/$/, '');
  return {
    url: url.href,
    kind: maps ? 'maps' : 'web',
    label: maps ? 'Google Maps' : host,
    short: shorten(`${host}${path === '/' ? '' : path}`, 44),
  };
}

interface Found {
  raw: string;
  link: NoteLink;
  index: number;
}

// A run of digits, written with spaces, dots, hyphens or brackets: "+995 555 12-34-56".
// Never longer than one line, and never glued to letters or other digits.
const PHONE_RUN = /(?<![\p{L}\p{N}_])[+(]?\d[\d ().\-\u00A0\t]{5,24}\d(?![\p{L}\p{N}_])/gu;

/**
 * Turns what was written into an international number ("+995555123456"), or null when it does
 * not look like a phone number. Deliberately strict, so dates, prices, ID codes and coordinates
 * are left alone: it needs a "+" (or "00") with 8-15 digits, or a Georgian mobile (9 digits
 * starting with 5), a Georgian number with the leading 0 (10 digits), or 995 followed by 9 digits.
 */
export function normalizePhone(raw: string): string | null {
  const text = raw.trim();
  const digits = text.replace(/\D/g, '');
  const international = (d: string) => (d.length >= 8 && d.length <= 15 ? `+${d}` : null);
  if (text.startsWith('+')) return international(digits);
  if (digits.startsWith('00')) return international(digits.slice(2));
  if (/^995\d{9}$/.test(digits)) return `+${digits}`;
  if (/^5\d{8}$/.test(digits)) return `+995${digits}`;
  if (/^0[1-9]\d{8}$/.test(digits)) return `+995${digits.slice(1)}`;
  return null;
}

function findPhones(text: string, urls: Found[]): Found[] {
  // Digits inside web addresses (ids, coordinates) are not phone numbers: blank them out first.
  let masked = text;
  for (const found of urls) {
    masked = masked.slice(0, found.index) + ' '.repeat(found.raw.length) + masked.slice(found.index + found.raw.length);
  }
  const phones: Found[] = [];
  for (const match of masked.matchAll(PHONE_RUN)) {
    const raw = match[0].trim();
    const e164 = normalizePhone(raw);
    if (!e164) continue;
    phones.push({
      raw,
      index: match.index,
      link: { url: `tel:${e164}`, kind: 'phone', label: raw.replace(/\s+/g, ' '), short: raw.replace(/\s+/g, ' ') },
    });
  }
  return phones;
}

function find(text: string): Found[] {
  const urls: Found[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailing(match[0]);
    const url = toHttpUrl(raw);
    if (url) urls.push({ raw, link: describe(url), index: match.index });
  }
  return [...urls, ...findPhones(text, urls)].sort((a, b) => a.index - b.index);
}

/** Every web address and phone number in a piece of text, in order. */
export function extractLinks(text: string): NoteLink[] {
  return find(text).map((f) => f.link);
}

function unique(links: NoteLink[]): NoteLink[] {
  const seen = new Set<string>();
  return links.filter((link) => (seen.has(link.url) ? false : (seen.add(link.url), true)));
}

/** Links written in the title or the text of a note (not in checklist rows). */
export function textLinks(note: Pick<Note, 'title' | 'body'>): NoteLink[] {
  return unique([...extractLinks(note.title), ...extractLinks(note.body)]);
}

/** Every link in a note, including checklist rows. */
export function noteLinks(note: Pick<Note, 'title' | 'body' | 'items'>): NoteLink[] {
  return unique([
    ...extractLinks(note.title),
    ...extractLinks(note.body),
    ...note.items.flatMap((item) => extractLinks(item.text)),
  ]);
}

/** If a line is nothing but one address or phone number, describe it; otherwise null. */
export function asOnlyLink(line: string): NoteLink | null {
  const text = line.trim();
  const found = find(text);
  return found.length === 1 && found[0]!.raw === text ? found[0]!.link : null;
}
