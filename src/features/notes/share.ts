import { displayTitle, type NoteContent } from './model';

export interface SharePayload {
  /** Used as the subject by apps that have one (e-mail). */
  title: string;
  /** The whole note as plain text. */
  text: string;
}

/**
 * Turns a note into plain text for sending to other apps: the title, then the text,
 * or for a checklist one line per row with ☐ / ☑. Returns null when there is nothing to send.
 */
export function noteToShare(content: NoteContent): SharePayload | null {
  const title = content.title.trim();
  const lines: string[] = [];
  if (title !== '') lines.push(title);

  if (content.kind === 'checklist') {
    const rows = content.items
      .filter((item) => item.text.trim() !== '')
      .map((item) => `${item.done ? '☑' : '☐'} ${item.text.trim()}`);
    if (title !== '' && rows.length > 0) lines.push('');
    lines.push(...rows);
  } else {
    const body = content.body.trim();
    if (body !== '') {
      if (title !== '') lines.push('');
      lines.push(body);
    }
  }

  const text = lines.join('\n');
  if (text === '') return null;
  return { title: displayTitle(content), text };
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

interface ShareEnv {
  share?: (data: { title: string; text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

/**
 * Opens the phone's share menu. Where that isn't available (e.g. a desktop browser) the text is
 * copied instead, so the button always does something useful. Call it straight from a tap.
 */
export async function sharePayload(
  payload: SharePayload,
  env: ShareEnv = navigator as unknown as ShareEnv,
): Promise<ShareResult> {
  if (typeof env.share === 'function') {
    try {
      await env.share.call(env, { title: payload.title, text: payload.text });
      return 'shared';
    } catch (error) {
      // Closing the share menu without choosing an app is not an error.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    if (env.clipboard) {
      await env.clipboard.writeText(payload.text);
      return 'copied';
    }
  } catch {
    // fall through
  }
  return 'failed';
}
