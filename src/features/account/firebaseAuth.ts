import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseConfig } from '@/core/firebase/config';
import type { AuthClient, AuthUser } from './authClient';

function toUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email ?? '' };
}

export function createFirebaseAuth(): AuthClient {
  const auth = getAuth(initializeApp(firebaseConfig));
  const google = new GoogleAuthProvider();
  // Always offer the account chooser, so the right Google account can be picked on shared phones.
  google.setCustomParameters({ prompt: 'select_account' });
  return {
    onChange: (callback) => onAuthStateChanged(auth, (user) => callback(user ? toUser(user) : null)),
    signInWithGoogle: async () => toUser((await signInWithPopup(auth, google)).user),
    signIn: async (email, password) => toUser((await signInWithEmailAndPassword(auth, email, password)).user),
    signUp: async (email, password) => toUser((await createUserWithEmailAndPassword(auth, email, password)).user),
    signOut: () => signOut(auth),
    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
  };
}
