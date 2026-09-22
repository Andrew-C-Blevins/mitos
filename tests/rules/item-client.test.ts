import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { captureItem } from '@/lib/domain/items';
import { encode } from '@/lib/data/codec';
import type { Item } from '@/lib/types';
const adapter = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/data/client/firebase', () => ({ getFirebase: adapter.get }));
import { editEntry, subscribeItem, subscribeItems, deleteItem } from '@/lib/data/client/items';

let env: RulesTestEnvironment;
const viewer = { uid: 'andrew-uid', personId: 'andrew', householdIds: ['blevins'] };
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mitos-client-tests',
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
  });
  await env.clearFirestore();
  const item = captureItem('Live step updates', viewer, new Date().toISOString(), 'steps');
  item.steps = [
    { id: 'first', text: 'Delete this step', done: false },
    { id: 'second', text: 'Keep this step', done: false },
  ];
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'households/blevins'), { memberUids: [viewer.uid] });
    await setDoc(doc(db, `users/${viewer.uid}`), { personId: viewer.personId });
    await setDoc(doc(db, 'items/steps'), encode(item, Timestamp.fromDate));
  });
  adapter.get.mockReturnValue({
    db: env
      .authenticatedContext(viewer.uid, { email: 'andrew@mitos.test', email_verified: true })
      .firestore(),
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
  return env?.cleanup();
});
it('updates an already-open item after deleting successive steps, without resubscribing', async () => {
  let current: Item | null = null;
  const stop = subscribeItem(
    'steps',
    (item) => {
      current = item;
    },
    (error) => {
      throw error;
    },
  );
  try {
    await vi.waitFor(() => expect(current?.steps).toHaveLength(2));
    const saved = await editEntry('steps', 'steps', current!.steps[0]);
    // UI can use the confirmed result even before the listener catches up.
    expect(saved.steps.map((step) => step.id)).toEqual(['second']);
    expect(saved.version).toBe(2);
    await vi.waitFor(() => expect(current?.steps.map((step) => step.id)).toEqual(['second']));
    await editEntry('steps', 'steps', current!.steps[0]);
    await vi.waitFor(() => expect(current?.steps).toEqual([]));
  } finally {
    stop();
  }
});
it('removes a confirmed server deletion from the list even before the live query catches up', async () => {
  adapter.get.mockReturnValue({
    ...adapter.get(),
    auth: { currentUser: { getIdToken: async () => 'local-test-token' } },
  });
  const request = vi.fn();
  vi.stubGlobal('fetch', request);
  let items: Item[] = [];
  const stop = subscribeItems(
    viewer,
    (rows) => {
      items = rows;
    },
    (error) => {
      throw error;
    },
  );
  try {
    await vi.waitFor(() => expect(items.map((item) => item.id)).toEqual(['steps']));
    const item = items[0];
    request.mockResolvedValueOnce(Response.json({ error: 'Not deleted' }, { status: 500 }));
    await expect(deleteItem(item)).rejects.toThrow('Not deleted');
    expect(items).toHaveLength(1);
    request.mockResolvedValueOnce(Response.json({ deleted: true }));
    await deleteItem(item);
    expect(items).toEqual([]);
    // This fixture intentionally still exists: its live stream did not send a
    // deletion. The list must use the successful API result, not await that stream.
    expect((await getDoc(doc(adapter.get().db, 'items/steps'))).exists()).toBe(true);
  } finally {
    stop();
  }
});
