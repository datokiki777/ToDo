/** Pulls a string "code" (like "auth/..." or "unavailable") out of whatever was thrown. */
export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'unknown';
}
