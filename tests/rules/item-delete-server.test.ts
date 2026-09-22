import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { captureItem } from '@/lib/domain/items';
import { encode } from '@/lib/data/codec';
vi.mock('server-only', () => ({}));
const adapter = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/data/admin/firebase', () => ({ getAdmin: adapter.get }));
import { deleteItem } from '@/lib/data/admin/delete-item';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-mitos-delete-tests' }, 'delete-tests');
const db = getFirestore(app);
const viewer = { uid: 'andrew-uid', personId: 'andrew', householdIds: ['blevins'] };
beforeAll(() => adapter.get.mockReturnValue({ db }));
afterAll(() => deleteApp(app));
beforeEach(async () => {
  for (const name of ['items', 'proposals', 'households'])
    await db.recursiveDelete(db.collection(name));
  const item = captureItem('Disposable deletion test', viewer, new Date().toISOString(), 'target');
  const batch = db.batch();
  batch.set(db.doc('households/blevins'), { memberUids: ['andrew-uid', 'karen-uid'] });
  batch.set(db.doc('items/target'), encode(item, Timestamp.fromDate));
  batch.set(
    db.doc('items/child'),
    encode({ ...item, id: 'child', parentId: 'target' }, Timestamp.fromDate),
  );
  batch.set(db.doc('items/other'), encode({ ...item, id: 'other' }, Timestamp.fromDate));
  for (let i = 0; i < 30; i++)
    batch.set(db.doc(`items/target/log/${i}`), { text: 'Disposable history' });
  batch.set(db.doc('items/child/log/keep'), { text: 'Keep child history' });
  batch.set(db.doc('proposals/target-proposal'), {
    targetItemId: 'target',
    rawInput: 'Discard this source too',
  });
  batch.set(db.doc('proposals/other-proposal'), { targetItemId: 'other' });
  await batch.commit();
});
it('permanently removes the item, all history pages and proposals while preserving separate sub-items', async () => {
  await deleteItem('target', 1, viewer);
  expect((await db.doc('items/target').get()).exists).toBe(false);
  expect((await db.collection('items/target/log').get()).empty).toBe(true);
  expect((await db.doc('proposals/target-proposal').get()).exists).toBe(false);
  expect((await db.doc('proposals/other-proposal').get()).exists).toBe(true);
  const child = (await db.doc('items/child').get()).data();
  expect(child?.parentId).toBeUndefined();
  expect(child?.version).toBe(2);
  expect((await db.doc('items/child/log/keep').get()).exists).toBe(true);
  expect((await db.doc('items/other').get()).exists).toBe(true);
});
it('rejects stale confirmation without partially deleting history', async () => {
  await db.doc('items/target').update({ version: 2 });
  await expect(deleteItem('target', 1, viewer)).rejects.toMatchObject({ status: 409 });
  expect((await db.collection('items/target/log').get()).size).toBe(30);
  expect((await db.doc('proposals/target-proposal').get()).exists).toBe(true);
});
it('denies other private owners, cross-household viewers, and revoked members', async () => {
  for (const unauthorized of [
    { ...viewer, uid: 'karen-uid', personId: 'karen' },
    { ...viewer, householdIds: ['elsewhere'] },
    { ...viewer, uid: 'revoked-uid' },
  ])
    await expect(deleteItem('target', 1, unauthorized)).rejects.toMatchObject({ status: 404 });
  expect((await db.doc('items/target').get()).exists).toBe(true);
  expect((await db.collection('items/target/log').get()).size).toBe(30);
});
it('allows a current member to delete a household item without an admin role', async () => {
  await db.doc('items/target').update({ scope: 'household' });
  await deleteItem('target', 1, { ...viewer, uid: 'karen-uid', personId: 'karen' });
  expect((await db.doc('items/target').get()).exists).toBe(false);
});
