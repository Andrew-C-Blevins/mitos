import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
vi.mock('server-only', () => ({}));
const adapter = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/data/admin/firebase', () => ({ getAdmin: adapter.get }));
import { changePerson } from '@/lib/data/admin/people';

// Isolated emulator project; never loads production configuration or credentials.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-mitos-people-tests' }, 'people-tests');
const db = getFirestore(app);
const viewer = (name: string) => ({
  uid: `${name}-uid`,
  personId: name,
  householdIds: ['blevins'],
});
beforeAll(() => adapter.get.mockReturnValue({ db }));
afterAll(() => deleteApp(app));
beforeEach(async () => {
  for (const collection of ['households', 'people', 'items']) {
    const docs = await db.collection(collection).get();
    const cleanup = db.batch();
    docs.forEach((doc) => cleanup.delete(doc.ref));
    await cleanup.commit();
  }
  const batch = db.batch();
  batch.set(db.doc('households/blevins'), {
    name: 'Blevins',
    memberUids: ['andrew-uid', 'karen-uid'],
    adminUids: ['andrew-uid'],
    createdAt: Timestamp.now(),
  });
  for (const name of ['andrew', 'karen'])
    batch.set(db.doc(`people/${name}`), {
      name,
      uid: `${name}-uid`,
      householdId: 'blevins',
      status: 'active',
      color: name === 'andrew' ? '#537a67' : '#976783',
      createdAt: Timestamp.now(),
    });
  batch.set(db.doc('people/archived'), {
    name: 'Archived fixture',
    householdId: 'blevins',
    status: 'archived',
    color: '#777777',
    createdAt: Timestamp.now(),
  });
  await batch.commit();
});
it('prevents concurrent color choices from producing duplicate household colors', async () => {
  const results = await Promise.allSettled(
    ['andrew', 'karen'].map((name) =>
      changePerson(name, { action: 'color', value: '#87684d' }, viewer(name)),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const people = await db.collection('people').where('status', '==', 'active').get();
  expect(new Set(people.docs.map((doc) => doc.data().color)).size).toBe(2);
});
it('retains an active admin when two admins attempt concurrent demotion', async () => {
  await changePerson('karen', { action: 'role', value: 'admin' }, viewer('andrew'));
  const results = await Promise.allSettled(
    ['andrew', 'karen'].map((name) =>
      changePerson(name, { action: 'role', value: 'user' }, viewer(name)),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect((await db.doc('households/blevins').get()).data()?.adminUids).toHaveLength(1);
});
it('denies user management and revokes access when an admin archives a member', async () => {
  await expect(
    changePerson('andrew', { action: 'status', value: 'archived' }, viewer('karen')),
  ).rejects.toThrow('Only a household admin');
  await changePerson('karen', { action: 'status', value: 'archived' }, viewer('andrew'));
  expect((await db.doc('households/blevins').get()).data()?.memberUids).toEqual(['andrew-uid']);
  await expect(
    changePerson('karen', { action: 'color', value: '#87684d' }, viewer('karen')),
  ).rejects.toThrow('not a member');
  await changePerson('karen', { action: 'status', value: 'active' }, viewer('andrew'));
  expect((await db.doc('households/blevins').get()).data()?.memberUids).toContain('karen-uid');
});
it('preserves referenced people and permits removal only of an unused archived record', async () => {
  await db.doc('items/history').set({ ownerPersonIds: ['archived'] });
  await expect(changePerson('archived', { action: 'delete' }, viewer('andrew'))).rejects.toThrow(
    'item history',
  );
  await db.doc('items/history').delete();
  await changePerson('archived', { action: 'delete' }, viewer('andrew'));
  expect((await db.doc('people/archived').get()).exists).toBe(false);
});
