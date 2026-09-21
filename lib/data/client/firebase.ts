'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  memoryLocalCache,
} from 'firebase/firestore';

export const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
export const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
export function getFirebase() {
  if (!firebaseConfigured)
    throw new Error('Firebase is not configured. Follow the local setup in README.md.');
  const existing = getApps()[0];
  if (existing) return { auth: getAuth(existing), db: initializeDb(existing) };
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = initializeDb(app);
  if (useEmulators) {
    // The demo project plus explicit opt-in prevents accidentally touching production.
    if (app.options.projectId !== 'demo-mitos')
      throw new Error('Emulator mode requires demo-mitos.');
    const host = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname;
    const port = typeof window === 'undefined' ? 3000 : Number(window.location.port || 80);
    connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, port);
  }
  return { auth, db };
}
let firestore: ReturnType<typeof initializeFirestore> | undefined;
function initializeDb(app: ReturnType<typeof initializeApp>) {
  if (!firestore)
    firestore = initializeFirestore(app, {
      localCache:
        typeof window !== 'undefined' && window.isSecureContext
          ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          : memoryLocalCache(),
    });
  return firestore;
}
