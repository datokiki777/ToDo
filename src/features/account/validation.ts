export const MIN_PASSWORD_LENGTH = 8;

/** Returns a translation key describing what is wrong, or null when the address looks fine. */
export function emailProblem(email: string): string | null {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? null : 'account.errorEmailFormat';
}

export function passwordProblem(password: string): string | null {
  return password.length >= MIN_PASSWORD_LENGTH ? null : 'account.errorPasswordShort';
}
