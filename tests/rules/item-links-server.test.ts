import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { item, viewer } from '../fixtures';
import { encode } from '@/lib/data/codec';
vi.mock('server-only', () => ({}));
const adapter = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/data/admin/firebase', () => ({ getAdmin: adapter.get }));
import { getItem } from '@/lib/data/admin/items';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-mitos-links-tests' }, 'links-tests');
const db = getFirestore(app);
const alias = 'a'.repeat(32);
beforeAll(async () => {
  adapter.get.mockReturnValue({ db });
  await db
    .doc('items/legacy-test')
    .set(encode(item({ id: 'legacy-test', urlId: alias }), Timestamp.fromDate));
});
afterAll(async () => {
  await db.doc('items/legacy-test').delete();
  await deleteApp(app);
});
it('resolves old and opaque links to the same protected document', async () => {
  expect((await getItem('legacy-test', viewer)).id).toBe('legacy-test');
  expect((await getItem(alias, viewer)).id).toBe('legacy-test');
  const other = { ...viewer, uid: 'karen-uid', personId: 'karen' };
  await expect(getItem(alias, other)).rejects.toThrow('Item not found');
  await expect(getItem('legacy-test', other)).rejects.toThrow('Item not found');
  await expect(getItem('b'.repeat(32), viewer)).rejects.toThrow('Item not found');
});
