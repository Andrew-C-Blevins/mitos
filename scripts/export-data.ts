import { mkdir, writeFile } from 'node:fs/promises';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { decode } from '../lib/data/codec';
import { canAccess } from '../lib/domain/items';
import type { Item, Viewer } from '../lib/types';
import { loadEnvFile } from 'node:process';
try {
  loadEnvFile('.env.local');
} catch {
  /* Environment can also come from shell. */
}
const uid = process.argv.find((arg) => arg.startsWith('--uid='))?.slice(6);
if (!uid || uid.includes('/'))
  throw new Error('Supply --uid=<the user whose authorized data to export>.');
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.');
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (emulator && projectId !== 'demo-mitos') throw new Error('Emulator export requires demo-mitos.');
const app = initializeApp({ projectId, ...(emulator ? {} : { credential: applicationDefault() }) });
const db = getFirestore(app),
  user = await getAuth(app).getUser(uid);
if (
  user.disabled ||
  !user.emailVerified ||
  !(process.env.ALLOWED_EMAILS ?? '').split(',').includes(user.email ?? '')
)
  throw new Error('User is not allowlisted.');
const profileDoc = await db.doc(`users/${uid}`).get(),
  profile = profileDoc.data();
if (!profile) throw new Error('User has not signed in.');
const households = await Promise.all(
  (profile.householdIds as string[]).map((id) => db.doc(`households/${id}`).get()),
);
if (households.some((doc) => !doc.data()?.memberUids.includes(uid)))
  throw new Error('Membership has changed.');
const viewer: Viewer = { uid, personId: profile.personId, householdIds: profile.householdIds };
const snapshots = await Promise.all(
  viewer.householdIds.map((id) => db.collection('items').where('householdId', '==', id).get()),
);
const items = snapshots
  .flatMap((snapshot) => snapshot.docs.map((doc) => decode<Item>(doc.id, doc.data())))
  .filter((item) => canAccess(item, viewer));
const records = await Promise.all(
  items.map(async (item) => ({
    ...item,
    log: (await db.collection(`items/${item.id}/log`).orderBy('at').get()).docs.map((doc) =>
      decode(doc.id, doc.data()),
    ),
    proposals: (
      await db.collection('proposals').where('targetItemId', '==', item.id).get()
    ).docs.map((doc) => decode(doc.id, doc.data())),
  })),
);
const people = (
  await Promise.all(
    viewer.householdIds.map((id) => db.collection('people').where('householdId', '==', id).get()),
  )
).flatMap((snapshot) => snapshot.docs.map((doc) => decode(doc.id, doc.data())));
await mkdir('exports', { recursive: true });
const path = `exports/mitos-${uid}-${new Date().toISOString().replaceAll(':', '-')}.json`;
await writeFile(
  path,
  JSON.stringify(
    {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      user: decode(uid, profile),
      households: households.map((doc) => decode(doc.id, doc.data()!)),
      people,
      items: records,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Exported ${records.length} authorized items, logs, proposals, household and people records to ${path}. Credentials are excluded.`,
);
