/**
 * Public identifiers of the Firebase project. They are not secrets: every website that uses
 * Firebase ships them to the browser. Access to the data is protected by the Firestore rules
 * (see docs/firestore.rules), not by hiding these values.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyC3e_XCbiucPQpOjXzSpvXMQ0pGeNv2Qwk',
  authDomain: 'todo-f1950.firebaseapp.com',
  projectId: 'todo-f1950',
  storageBucket: 'todo-f1950.firebasestorage.app',
  messagingSenderId: '282982733147',
  appId: '1:282982733147:web:37f24b0a74812702d3367e',
} as const;
