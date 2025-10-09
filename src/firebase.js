// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// .env.local (do not commit):
// VITE_FIREBASE_API_KEY=...
// VITE_FIREBASE_AUTH_DOMAIN=...
// VITE_FIREBASE_PROJECT_ID=...
// VITE_FIREBASE_APP_ID=...
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseProjectId = firebaseConfig.projectId;

const app = initializeApp(firebaseConfig);

// Firestore with persistent offline cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Auth (email/password only)
export const auth = getAuth(app);

// Persist session across reloads in this browser/profile
async function ensurePersistence() {
  await setPersistence(auth, browserLocalPersistence);
}

export async function signUpWithEmail(email, password) {
  await ensurePersistence();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email, password) {
  await ensurePersistence();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function signOutUser() {
  return signOut(auth);
}
export { onAuthStateChanged };

// Runtime config helpers
export function getRuntimeConfig() {
  return {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

// Optional: clear the IndexedDB Firestore cache
import { clearIndexedDbPersistence } from "firebase/firestore";
export async function clearFirestoreCache() {
  try {
    await clearIndexedDbPersistence(db);
    alert("Offline cache cleared. Reload the page.");
  } catch (e) {
    // If there are active tabs/instances, this will fail.
    alert("Close other tabs of this app and try again.\n\n" + (e?.message || e));
  }
}