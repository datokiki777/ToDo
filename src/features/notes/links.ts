import type { Note } from './model';

export type LinkKind = 'maps' | 'web';

export interface NoteLink {
  /** Always a full http(s) address, safe to put in an <a href>. */
  url: string;
  kind: LinkKind;
  /** "Google Maps" for map links, otherwise the site name. */
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
}

function find(text: string): Found[] {
  const found: Found[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailing(match[0]);
    const url = toHttpUrl(raw);
    if (url) found.push({ raw, link: describe(url) });
  }
  return found;
}

/** Every web address in a piece of text, in order. */
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

/** If a line is nothing but one address, describe it; otherwise null. */
export function asOnlyLink(line: string): NoteLink | null {
  const text = line.trim();
  const found = find(text);
  return found.length === 1 && found[0]!.raw === text ? found[0]!.link : null;
}
