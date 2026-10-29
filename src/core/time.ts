const monthNamesCache = new Map<string, boolean>();

/** Some browsers lack month names for a language and print things like "M10". Detect that. */
export function hasMonthNames(locale: string): boolean {
  const cached = monthNamesCache.get(locale);
  if (cached !== undefined) return cached;
  const sample = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2026, 9, 1));
  const ok = !/\d/.test(sample);
  monthNamesCache.set(locale, ok);
  return ok;
}

/** Short, locale-aware date for lists: time today, "12 Oct" this year, full date otherwise. */
export function formatShortDate(
  timestamp: number,
  locale: string,
  now: number = Date.now(),
  monthNames: boolean = hasMonthNames(locale),
): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  const month = monthNames ? 'short' : '2-digit';
  const day = monthNames ? 'numeric' : '2-digit';
  if (date.getFullYear() === today.getFullYear()) {
    return new Intl.DateTimeFormat(locale, { day, month }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { day, month, year: 'numeric' }).format(date);
}

export function formatLongDate(
  timestamp: number,
  locale: string,
  monthNames: boolean = hasMonthNames(locale),
): string {
  const date = new Date(timestamp);
  if (monthNames) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
