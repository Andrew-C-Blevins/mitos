import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
function cloudCredential(projectId: string) {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!value) return applicationDefault();
  let account: { project_id?: string; client_email?: string; private_key?: string };
  try {
    account = JSON.parse(value);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON');
  }
  if (account.project_id !== projectId || !account.client_email || !account.private_key)
    throw new Error('The Firebase service account must belong to FIREBASE_PROJECT_ID');
  return cert({ projectId, clientEmail: account.client_email, privateKey: account.private_key });
}
export function getAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required');
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (emulator && projectId !== 'demo-mitos') throw new Error('Local emulators require demo-mitos');
  const app =
    getApps()[0] ??
    initializeApp({ projectId, ...(emulator ? {} : { credential: cloudCredential(projectId) }) });
  return { db: getFirestore(app), auth: getAuth(app) };
}
