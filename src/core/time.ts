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

/** A calendar day given as "2026-10-30", written the way the language writes dates. */
export function formatDay(
  key: string,
  locale: string,
  monthNames: boolean = hasMonthNames(locale),
): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(
    locale,
    monthNames ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' },
  ).format(date);
}

/** A short day for badges: "31 Oct", or "31.10" when there are no month names, plus the year if not this one. */
export function formatDayShort(
  key: string,
  locale: string,
  now: number = Date.now(),
  monthNames: boolean = hasMonthNames(locale),
): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const sameYear = y === new Date(now).getFullYear();
  if (!monthNames) {
    // Written by hand so the order is never in doubt: day first.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d)}.${pad(m)}${sameYear ? '' : `.${String(y).slice(-2)}`}`;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(y, m - 1, d));
}
