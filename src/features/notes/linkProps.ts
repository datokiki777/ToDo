import type { TFunction } from 'i18next';
import type { NoteLink } from './links';

/** Web addresses open in a new tab; a phone number must not (it hands over to the dialer). */
export function linkTarget(link: NoteLink): { target?: string; rel?: string } {
  return link.kind === 'phone' ? {} : { target: '_blank', rel: 'noopener noreferrer' };
}

/** "Open Google Maps" / "Call +995 ..." for screen readers and tooltips. */
export function linkLabel(t: TFunction, link: NoteLink): string {
  return link.kind === 'phone'
    ? t('links.callLink', { label: link.label })
    : t('links.openLink', { label: link.label });
}
