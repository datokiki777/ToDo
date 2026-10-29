import { ExternalLink, MapPin } from 'lucide-react';
import type { LinkKind } from '../links';

/** A pin for map links, an arrow-out-of-box for everything else. */
export function LinkIcon({ kind, size = 20 }: { kind: LinkKind; size?: number }) {
  return kind === 'maps' ? (
    <MapPin size={size} aria-hidden="true" />
  ) : (
    <ExternalLink size={size} aria-hidden="true" />
  );
}
