import { readFile } from 'node:fs/promises';
import { applicationDefault, initializeApp, type Credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { migrateTask, type LegacyTask } from '../lib/domain/migration';
import { encode } from '../lib/data/codec';

// One-time operator migration. Never imported by app/API/AI code.
export async function seedCloud(
  credential: Credential = applicationDefault(),
  operatorDatabase?: Firestore,
) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!process.argv.includes('--apply') || projectId !== 'mitos-twelvedegrees')
    throw new Error('Cloud seed requires --apply and FIREBASE_PROJECT_ID=mitos-twelvedegrees');
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Cloud seed must run without emulator environment variables');
  const emails = [process.env.ANDREW_EMAIL, process.env.KAREN_EMAIL];
  if (emails.some((email) => !email || !email.includes('@') || email.endsWith('.test')))
    throw new Error('Both real Google account emails are required');
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase());
  if (
    new Set(allowed).size !== 2 ||
    emails.some((email) => !allowed.includes(email!.toLowerCase()))
  )
    throw new Error('The seed emails must exactly match the two-account allowlist');
  const app = initializeApp({ projectId, credential }, 'mitos-cloud-seed');
  const auth = getAuth(app),
    db = operatorDatabase ?? getFirestore(app),
    now = new Date().toISOString();
  const uids: string[] = [];
  for (const [index, name] of ['Andrew', 'Karen'].entries()) {
    let user;
    try {
      user = await auth.getUserByEmail(emails[index]!);
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      // No password, provider credential, or fake email verification is created.
      // Google verifies the real account on its first sign-in.
      user = await auth.createUser({ email: emails[index]!, displayName: name });
    }
    uids.push(user.uid);
  }
  const timestamp = Timestamp.fromDate(new Date(now));
  await db.runTransaction(async (transaction) => {
    const refs = ['households/blevins', 'people/andrew', 'people/karen', 'people/diana'].map(
      (path) => db.doc(path),
    );
    const docs = await transaction.getAll(...refs);
    if (docs[0].exists && uids.some((uid) => !docs[0].data()!.memberUids.includes(uid)))
      throw new Error('Existing household membership differs; manual review required');
    for (const index of [1, 2])
      if (docs[index].exists && docs[index].data()!.uid !== uids[index - 1])
        throw new Error('Existing person UID differs; manual review required');
    if (docs[3].exists && (docs[3].data()!.uid || docs[3].data()!.status !== 'archived'))
      throw new Error('Diana must remain archived without a login');
    const values = [
      { name: 'Blevins', memberUids: uids, createdAt: timestamp },
      {
        name: 'Andrew',
        householdId: 'blevins',
        uid: uids[0],
        status: 'active',
        color: '#537a67',
        createdAt: timestamp,
      },
      {
        name: 'Karen',
        householdId: 'blevins',
        uid: uids[1],
        status: 'active',
        color: '#976783',
        createdAt: timestamp,
      },
      {
        name: 'Diana',
        householdId: 'blevins',
        status: 'archived',
        color: '#777777',
        createdAt: timestamp,
        archivedAt: timestamp,
      },
    ];
    docs.forEach((doc, index) => {
      if (!doc.exists) transaction.create(refs[index], values[index]);
    });
  });
  const legacy = JSON.parse(await readFile('legacy/legacy-export.json', 'utf8')) as {
    records: { kind: string; slug: string; tasks?: LegacyTask[] }[];
  };
  let imported = 0,
    preserved = 0,
    heldForReview = 0,
    key: string | null = null;
  for (const list of ['personal-projects', 'home-projects'] as const) {
    const source = legacy.records.find((record) => record.kind === 'list' && record.slug === list);
    for (const task of source?.tasks ?? []) {
      const result = migrateTask(
        task,
        list,
        { uid: uids[0], personId: 'andrew', householdIds: ['blevins'] },
        now,
        key,
      );
      key = result.item.sortKey;
      if (result.review.length) {
        heldForReview++;
        continue;
      }
      const ref = db.doc(`items/${result.item.id}`);
      if ((await ref.get()).exists) {
        preserved++;
        continue;
      }
      const batch = db.batch();
      batch.create(ref, encode(result.item, Timestamp.fromDate));
      for (const entry of result.log)
        batch.create(ref.collection('log').doc(entry.id), encode(entry, Timestamp.fromDate));
      await batch.commit();
      imported++;
    }
  }
  // users are created only on first sign-in; no credentials are issued here.
  console.log(
    JSON.stringify({
      projectId,
      household: 'Blevins',
      people: ['Andrew', 'Karen', 'Diana (archived, no UID)'],
      imported,
      preserved,
      heldForReview,
    }),
  );
}
if (process.argv[1]?.endsWith('seed-cloud.ts')) await seedCloud();
