import type { AuthClient, AuthUser } from './authClient';

/**
 * An in-browser stand-in for Firebase, used only by the test build (VITE_FAKE_AUTH=1) so the
 * sign-in screens can be exercised without a network. It reproduces Firebase's error codes.
 */
const USERS = 'fake-auth.users';
const SESSION = 'fake-auth.session';

class FakeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 120));
const readUsers = (): Record<string, string> => JSON.parse(localStorage.getItem(USERS) ?? '{}');

export function createFakeAuth(): AuthClient {
  const listeners = new Set<(user: AuthUser | null) => void>();
  const current = (): AuthUser | null => {
    const email = localStorage.getItem(SESSION);
    return email ? { uid: `uid-${email}`, email } : null;
  };
  const emit = () => listeners.forEach((listener) => listener(current()));

  const guard = async (email: string) => {
    await wait();
    if (email.includes('offline')) throw new FakeError('auth/network-request-failed');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new FakeError('auth/invalid-email');
  };

  return {
    onChange(callback) {
      listeners.add(callback);
      setTimeout(() => callback(current()), 30);
      return () => listeners.delete(callback);
    },
    async signInWithGoogle() {
      await wait();
      // Tests choose the outcome through this flag: an address, "cancel" or "blocked".
      const choice = localStorage.getItem('fake-auth.google') ?? 'google.user@gmail.com';
      if (choice === 'cancel') throw new FakeError('auth/popup-closed-by-user');
      if (choice === 'blocked') throw new FakeError('auth/popup-blocked');
      if (choice === 'domain') throw new FakeError('auth/unauthorized-domain');
      localStorage.setItem(SESSION, choice);
      emit();
      return current()!;
    },
    async signIn(email, password) {
      await guard(email);
      if (email.startsWith('toomany')) throw new FakeError('auth/too-many-requests');
      if (readUsers()[email] !== password) throw new FakeError('auth/invalid-credential');
      localStorage.setItem(SESSION, email);
      emit();
      return current()!;
    },
    async signUp(email, password) {
      await guard(email);
      if (email.startsWith('closed')) throw new FakeError('auth/admin-restricted-operation');
      if (password.length < 6) throw new FakeError('auth/weak-password');
      const users = readUsers();
      if (email in users) throw new FakeError('auth/email-already-in-use');
      localStorage.setItem(USERS, JSON.stringify({ ...users, [email]: password }));
      localStorage.setItem(SESSION, email);
      emit();
      return current()!;
    },
    async signOut() {
      await wait();
      localStorage.removeItem(SESSION);
      emit();
    },
    async sendPasswordReset(email) {
      await guard(email); // like Firebase, it succeeds even for unknown addresses
    },
  };
}
