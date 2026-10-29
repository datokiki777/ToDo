export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * DAY_MS;

/** Whole days left before a trashed note is deleted for good (never less than 1 while it is listed). */
export function trashDaysLeft(deletedAt: number, now: number = Date.now()): number {
  const left = Math.ceil((deletedAt + TRASH_RETENTION_MS - now) / DAY_MS);
  return Math.min(TRASH_RETENTION_DAYS, Math.max(1, left));
}
