import 'server-only';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export function getAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required');
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (emulator && projectId !== 'demo-mitos') throw new Error('Local emulators require demo-mitos');
  const app =
    getApps()[0] ??
    initializeApp({ projectId, ...(emulator ? {} : { credential: applicationDefault() }) });
  return { db: getFirestore(app), auth: getAuth(app) };
}
