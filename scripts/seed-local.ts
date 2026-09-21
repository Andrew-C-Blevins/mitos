import { readFile } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { migrateTask, type LegacyTask } from '../lib/domain/migration';
import { encode } from '../lib/data/codec';

// Hard guard: this script has no production mode and never uses ADC.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const app = initializeApp({ projectId: 'demo-mitos' });
const auth = getAuth(app),
  db = getFirestore(app);
const now = new Date().toISOString();
for (const person of ['andrew', 'karen'] as const) {
  const uid = `local-${person}`;
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({
      uid,
      email: `${person}@mitos.test`,
      emailVerified: true,
      password: 'local-mitos-only',
      displayName: person === 'andrew' ? 'Andrew' : 'Karen',
    });
  }
}
const batch = db.batch();
const seed = async (path: string, data: Record<string, unknown>) => {
  if (!(await db.doc(path).get()).exists) batch.create(db.doc(path), data);
};
await seed('households/blevins', {
  name: 'Blevins',
  memberUids: ['local-andrew', 'local-karen'],
  createdAt: Timestamp.fromDate(new Date(now)),
});
await seed('people/andrew', {
  name: 'Andrew',
  householdId: 'blevins',
  uid: 'local-andrew',
  status: 'active',
  color: '#537a67',
  createdAt: Timestamp.fromDate(new Date(now)),
});
await seed('people/karen', {
  name: 'Karen',
  householdId: 'blevins',
  uid: 'local-karen',
  status: 'active',
  color: '#976783',
  createdAt: Timestamp.fromDate(new Date(now)),
});
await seed('people/diana', {
  name: 'Diana',
  householdId: 'blevins',
  status: 'archived',
  color: '#777777',
  createdAt: Timestamp.fromDate(new Date(now)),
  archivedAt: Timestamp.fromDate(new Date(now)),
});
// users are created by /api/session on the first actual sign-in; credentials are
// created only when a token is first issued in the future integration milestone.
await batch.commit();
const legacy = JSON.parse(await readFile('legacy/legacy-export.json', 'utf8')) as {
  records: { kind: string; slug: string; tasks?: LegacyTask[] }[];
};
let count = 0,
  key: string | null = null;
const reviews: string[] = [];
for (const list of ['personal-projects', 'home-projects'] as const) {
  const source = legacy.records.find((record) => record.kind === 'list' && record.slug === list);
  for (const task of source?.tasks ?? []) {
    const result = migrateTask(
      task,
      list,
      { uid: 'local-andrew', personId: 'andrew', householdIds: ['blevins'] },
      now,
      key,
    );
    key = result.item.sortKey;
    if (result.review.length) {
      reviews.push(`${task.id}: ${result.review.join(' ')}`);
      continue;
    }
    const ref = db.doc(`items/${result.item.id}`);
    if ((await ref.get()).exists) continue;
    const write = db.batch();
    write.create(ref, encode(result.item, Timestamp.fromDate));
    for (const entry of result.log)
      write.create(ref.collection('log').doc(entry.id), encode(entry, Timestamp.fromDate));
    await write.commit();
    count++;
  }
}
console.log(
  `Seeded Blevins; Andrew and Karen active with local Auth UIDs; Diana archived without a UID. Imported ${count} legacy items. Existing records were preserved.`,
);
if (reviews.length) console.log('Not imported; needs review:\n' + reviews.join('\n'));
