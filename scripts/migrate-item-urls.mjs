// One-time metadata backfill. Existing document IDs, histories and references stay put.
// Run dry first. Cloud application requires --apply --approved and an explicit project.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cert, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const args = process.argv.slice(2);
const local = args.includes('--local');
const option = (name) =>
  args
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const project = local ? 'demo-mitos' : option('project');
if (!local && project !== 'mitos-twelvedegrees') throw Error('Choose the explicit Mitos project.');
if (!local && args.includes('--apply') && !args.includes('--approved'))
  throw Error('Cloud apply requires approval.');
if (!local && process.env.FIRESTORE_EMULATOR_HOST)
  throw Error('Do not mix cloud and emulator configuration.');
if (local) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const account = local ? undefined : JSON.parse(await readFile(option('credential-file'), 'utf8'));
if (account && account.project_id !== project) throw Error('Credential project mismatch.');
const app = initializeApp({
  projectId: project,
  ...(account ? { credential: cert(account) } : {}),
});
try {
  const db = getFirestore(app);
  const snapshot = await db.collection('items').get();
  const occupied = new Set(
    snapshot.docs.flatMap((doc) => [doc.id, doc.data().urlId].filter(Boolean)),
  );
  const changes = snapshot.docs
    .filter((doc) => doc.id.startsWith('legacy-') && !doc.data().urlId)
    .map((doc) => {
      let urlId;
      do {
        urlId = randomBytes(16).toString('hex');
      } while (occupied.has(urlId));
      occupied.add(urlId);
      return { doc, urlId };
    });
  console.log(
    JSON.stringify({
      project,
      mode: args.includes('--apply') ? 'apply' : 'dry-run',
      importedItemsNeedingAliases: changes.length,
    }),
  );
  if (args.includes('--apply') && changes.length) {
    if (changes.length > 450) throw Error('Review a larger migration separately.');
    await mkdir('exports', { recursive: true });
    const backup = `exports/item-urls-${project}-${Date.now()}.json`;
    await writeFile(
      backup,
      JSON.stringify(
        changes.map(({ doc, urlId }) => ({ id: doc.id, before: doc.data(), urlId })),
        null,
        2,
      ),
      { flag: 'wx' },
    );
    const batch = db.batch();
    changes.forEach(({ doc, urlId }) =>
      batch.update(
        doc.ref,
        { urlId, version: doc.data().version + 1 },
        { lastUpdateTime: doc.updateTime },
      ),
    );
    await batch.commit();
    const after = await db.getAll(...changes.map(({ doc }) => doc.ref));
    if (after.some((doc, i) => doc.data()?.urlId !== changes[i].urlId))
      throw Error('Alias verification failed.');
    console.log(
      JSON.stringify({
        verified: after.length,
        backup,
        retained: 'document IDs, original links, content and subcollections',
      }),
    );
  }
} finally {
  await deleteApp(app);
}
