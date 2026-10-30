export interface AuthUser {
  uid: string;
  email: string;
}

/** What the app needs from an account system. Firebase implements it; tests use a fake. */
export interface AuthClient {
  /** Calls back with the current person now and whenever they sign in or out. Returns "stop". */
  onChange(callback: (user: AuthUser | null) => void): () => void;
  /** Opens Google's own sign-in window. */
  signInWithGoogle(): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
}

/** The Firebase code is loaded only when needed, as a separate download. */
export async function createAuthClient(): Promise<AuthClient> {
  if (__FAKE_AUTH__) return (await import('./fakeAuth')).createFakeAuth();
  return (await import('./firebaseAuth')).createFirebaseAuth();
}
