import { describe, expect, it } from 'vitest';
import { authErrorKey, errorCode, isCancellation } from './errors';
import { emailProblem, passwordProblem } from './validation';

describe('authErrorKey', () => {
  it('treats every "wrong login" variant the same, so it never reveals which part was wrong', () => {
    for (const code of [
      'auth/invalid-credential',
      'auth/invalid-login-credentials',
      'auth/wrong-password',
      'auth/user-not-found',
    ]) {
      expect(authErrorKey(code)).toBe('account.errorCredentials');
    }
  });

  it('gives each known problem its own message', () => {
    expect(authErrorKey('auth/email-already-in-use')).toBe('account.errorEmailInUse');
    expect(authErrorKey('auth/network-request-failed')).toBe('account.errorNetwork');
    expect(authErrorKey('auth/too-many-requests')).toBe('account.errorTooMany');
    expect(authErrorKey('auth/operation-not-allowed')).toBe('account.errorNotAllowed');
    expect(authErrorKey('auth/admin-restricted-operation')).toBe('account.errorSignupClosed');
  });

  it('has its own messages for Google sign-in problems', () => {
    expect(authErrorKey('auth/popup-closed-by-user')).toBe('account.errorGoogleCancelled');
    expect(authErrorKey('auth/cancelled-popup-request')).toBe('account.errorGoogleCancelled');
    expect(authErrorKey('auth/popup-blocked')).toBe('account.errorPopupBlocked');
    expect(authErrorKey('auth/unauthorized-domain')).toBe('account.errorDomain');
    expect(authErrorKey('auth/account-exists-with-different-credential')).toBe('account.errorDifferentMethod');
  });

  it('knows which codes are just the person closing the window', () => {
    expect(isCancellation('auth/popup-closed-by-user')).toBe(true);
    expect(isCancellation('auth/cancelled-popup-request')).toBe(true);
    expect(isCancellation('auth/popup-blocked')).toBe(false);
    expect(isCancellation('auth/network-request-failed')).toBe(false);
  });

  it('falls back to a generic message', () => {
    expect(authErrorKey('auth/something-new')).toBe('account.errorGeneric');
    expect(authErrorKey('unknown')).toBe('account.errorGeneric');
  });
});

describe('errorCode', () => {
  it('reads the code from Firebase-like errors and ignores anything else', () => {
    expect(errorCode({ code: 'auth/invalid-email' })).toBe('auth/invalid-email');
    expect(errorCode(new Error('plain'))).toBe('unknown');
    expect(errorCode(null)).toBe('unknown');
    expect(errorCode({ code: 5 })).toBe('unknown');
  });
});

describe('validation', () => {
  it('accepts normal addresses and rejects broken ones', () => {
    expect(emailProblem('me@example.com')).toBeNull();
    expect(emailProblem('  me@example.com ')).toBeNull();
    expect(emailProblem('me@example')).not.toBeNull();
    expect(emailProblem('me example.com')).not.toBeNull();
    expect(emailProblem('')).not.toBeNull();
  });

  it('wants at least 8 characters', () => {
    expect(passwordProblem('1234567')).not.toBeNull();
    expect(passwordProblem('12345678')).toBeNull();
    expect(passwordProblem('პაროლი123')).toBeNull();
  });
});
