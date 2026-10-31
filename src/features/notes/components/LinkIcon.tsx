import { ExternalLink, MapPin, Phone } from 'lucide-react';
import type { LinkKind } from '../links';

/** A pin for map links, a handset for phone numbers, an arrow-out-of-box for everything else. */
export function LinkIcon({ kind, size = 20 }: { kind: LinkKind; size?: number }) {
  if (kind === 'maps') return <MapPin size={size} aria-hidden="true" />;
  if (kind === 'phone') return <Phone size={size} aria-hidden="true" />;
  return <ExternalLink size={size} aria-hidden="true" />;
}
