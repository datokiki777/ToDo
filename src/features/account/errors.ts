/** Maps a Firebase error code to a translation key. Unknown codes get the generic message. */
export function authErrorKey(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'account.errorCredentials';
    case 'auth/email-already-in-use':
      return 'account.errorEmailInUse';
    case 'auth/invalid-email':
      return 'account.errorEmailFormat';
    case 'auth/weak-password':
      return 'account.errorPasswordShort';
    case 'auth/network-request-failed':
      return 'account.errorNetwork';
    case 'auth/too-many-requests':
      return 'account.errorTooMany';
    case 'auth/operation-not-allowed':
      return 'account.errorNotAllowed';
    case 'auth/user-disabled':
      return 'account.errorDisabled';
    case 'auth/admin-restricted-operation':
      return 'account.errorSignupClosed';
    default:
      return 'account.errorGeneric';
  }
}

/** Pulls the "auth/..." code out of whatever was thrown. */
export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'unknown';
}
