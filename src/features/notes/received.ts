import { asOnlyLink } from './links';

/** What Android hands over when something is shared to the app: any of the three may be missing. */
export interface SharedContent {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

export interface ReceivedNote {
  title: string;
  body: string;
}

const MAX_TITLE = 200;
const MAX_BODY = 20_000;
/** A first line longer than this reads as a sentence, not a name, so it does not become the title. */
const MAX_NAME_LINE = 100;

const clean = (value: string | null | undefined) => (value ?? '').replace(/\r\n?/g, '\n').trim();

/**
 * Turns shared content into a note, or null if there is nothing in it.
 *
 * - A web page arrives as title + address: the title becomes the title, the address the text.
 * - A place from Maps arrives as one block of text, "Name\nhttps://maps.app.goo.gl/…": the first
 *   line becomes the title when it is a name and not a link or a phone number.
 * - An address that arrives separately is added to the text unless the text already holds it.
 */
export function noteFromShare(shared: SharedContent): ReceivedNote | null {
  let title = clean(shared.title);
  const text = clean(shared.text);
  const url = clean(shared.url);

  const lines = text === '' ? [] : text.split('\n');
  if (url !== '' && !text.includes(url)) lines.push(url);

  // A title that is only the address says nothing: the address itself is in the text.
  if (title !== '' && title === url) title = '';
  // Some apps repeat the title as the first line of the text: say it once.
  if (title !== '' && lines[0]?.trim() === title) lines.shift();

  if (title === '' && lines.length >= 2) {
    const first = (lines[0] ?? '').trim();
    if (first !== '' && first.length <= MAX_NAME_LINE && asOnlyLink(first) === null) {
      title = first;
      lines.shift();
    }
  }

  const body = lines.join('\n').trim().slice(0, MAX_BODY);
  title = title.slice(0, MAX_TITLE);
  return title === '' && body === '' ? null : { title, body };
}
