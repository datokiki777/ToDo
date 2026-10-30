import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
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
  return {
    onChange: (callback) => onAuthStateChanged(auth, (user) => callback(user ? toUser(user) : null)),
    signIn: async (email, password) => toUser((await signInWithEmailAndPassword(auth, email, password)).user),
    signUp: async (email, password) => toUser((await createUserWithEmailAndPassword(auth, email, password)).user),
    signOut: () => signOut(auth),
    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
  };
}
