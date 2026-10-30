import { create } from 'zustand';
import { createAuthClient, type AuthClient, type AuthUser } from './authClient';
import { errorCode } from './errors';

export type AccountStatus = 'idle' | 'starting' | 'signedOut' | 'signedIn' | 'unavailable';
export type AccountResult = { ok: true } | { ok: false; code: string };

interface AccountState {
  status: AccountStatus;
  user: AuthUser | null;
  busy: boolean;
  /** Loads the account system and starts following the signed-in state. Safe to call repeatedly. */
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AccountResult>;
  signUp: (email: string, password: string) => Promise<AccountResult>;
  signOut: () => Promise<AccountResult>;
  sendPasswordReset: (email: string) => Promise<AccountResult>;
}

let client: AuthClient | null = null;

export const useAccount = create<AccountState>((set, get) => {
  const run = async (action: (c: AuthClient) => Promise<unknown>): Promise<AccountResult> => {
    await get().init();
    if (!client) return { ok: false, code: 'unavailable' };
    set({ busy: true });
    try {
      await action(client);
      return { ok: true };
    } catch (error) {
      return { ok: false, code: errorCode(error) };
    } finally {
      set({ busy: false });
    }
  };

  return {
    status: 'idle',
    user: null,
    busy: false,

    async init() {
      if (get().status !== 'idle') return;
      set({ status: 'starting' });
      try {
        client = await createAuthClient();
        client.onChange((user) => set({ user, status: user ? 'signedIn' : 'signedOut' }));
      } catch {
        set({ status: 'unavailable' });
      }
    },

    signIn: (email, password) => run((c) => c.signIn(email.trim(), password)),
    signUp: (email, password) => run((c) => c.signUp(email.trim(), password)),
    signOut: () => run((c) => c.signOut()),
    sendPasswordReset: (email) => run((c) => c.sendPasswordReset(email.trim())),
  };
});
