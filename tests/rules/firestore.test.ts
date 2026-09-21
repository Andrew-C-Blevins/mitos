import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  Timestamp,
  increment,
  arrayRemove,
  arrayUnion,
  deleteField,
  runTransaction,
} from 'firebase/firestore';

let env: RulesTestEnvironment;
const createdAt = Timestamp.fromDate(new Date('2026-09-21T14:00:00Z'));
const item = (patch: Record<string, unknown> = {}) => ({
  title: 'Test item',
  status: 'active',
  scope: 'private',
  householdId: 'blevins',
  ownerPersonIds: ['andrew'],
  createdBy: 'andrew-uid',
  category: 'personal',
  effort: 'quick',
  focus: 'normal',
  contexts: [],
  businessHours: false,
  needs: [],
  questions: [],
  decisions: [],
  steps: [],
  links: [],
  sortKey: 'a0',
  version: 1,
  createdAt,
  updatedAt: createdAt,
  ...patch,
});
const andrew = () =>
  env
    .authenticatedContext('andrew-uid', { email: 'andrew@mitos.test', email_verified: true })
    .firestore();
const karen = () =>
  env
    .authenticatedContext('karen-uid', { email: 'karen@mitos.test', email_verified: true })
    .firestore();
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mitos-rules',
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
  });
});
afterAll(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore(),
      batch = writeBatch(db);
    batch.set(doc(db, 'households/blevins'), {
      name: 'Blevins',
      memberUids: ['andrew-uid', 'karen-uid'],
      createdAt,
    });
    for (const name of ['andrew', 'karen']) {
      batch.set(doc(db, `users/${name}-uid`), {
        email: `${name}@mitos.test`,
        name,
        personId: name,
        householdIds: ['blevins'],
        createdAt,
      });
      batch.set(doc(db, `people/${name}`), {
        name,
        uid: `${name}-uid`,
        householdId: 'blevins',
        status: 'active',
        color: '#777',
        createdAt,
      });
    }
    batch.set(doc(db, 'people/diana'), {
      name: 'Diana',
      householdId: 'blevins',
      status: 'archived',
      color: '#777',
      createdAt,
      archivedAt: createdAt,
    });
    batch.set(doc(db, 'items/private'), item());
    batch.set(doc(db, 'items/shared'), item({ scope: 'household' }));
    batch.set(doc(db, 'items/private/log/capture'), {
      at: createdAt,
      by: 'andrew-uid',
      kind: 'capture',
      text: 'Original capture',
    });
    batch.set(doc(db, 'credentials/andrew-uid'), { captureTokenHash: 'secret-hash' });
    batch.set(doc(db, 'proposals/p1'), {
      source: 'agent',
      targetItemId: 'private',
      confidence: 'high',
      status: 'pending',
      createdAt,
      changes: [
        {
          id: 'c1',
          label: 'Next action',
          class: 'conditional',
          op: 'set',
          path: 'nextAction',
          value: 'Call',
          checked: true,
        },
        {
          id: 'c2',
          label: 'Title',
          class: 'conditional',
          op: 'set',
          path: 'title',
          value: 'Call insurer',
          checked: true,
        },
      ],
    });
    await batch.commit();
  });
});
describe('membership, privacy and account boundaries', () => {
  it('allows only personal context changes and household person status changes in Settings', async () => {
    const profile = doc(andrew(), 'users/andrew-uid');
    await assertSucceeds(updateDoc(profile, { defaultContext: 'yard' }));
    await assertSucceeds(updateDoc(profile, { defaultContext: deleteField() }));
    await assertFails(updateDoc(profile, { defaultContext: 'office' }));
    await assertFails(updateDoc(doc(karen(), 'users/andrew-uid'), { defaultContext: 'home' }));
    const person = doc(andrew(), 'people/diana');
    await assertSucceeds(updateDoc(person, { status: 'active' }));
    await assertSucceeds(updateDoc(person, { status: 'archived' }));
    await assertFails(updateDoc(person, { uid: 'andrew-uid' }));
    await assertFails(updateDoc(person, { status: 'deleted' }));
  });
  it('denies unauthenticated, non-allowlisted and unverified readers', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'items/shared')));
    for (const token of [
      { email: 'stranger@example.com', email_verified: true },
      { email: 'andrew@mitos.test', email_verified: false },
    ])
      await assertFails(
        getDoc(doc(env.authenticatedContext('andrew-uid', token).firestore(), 'items/shared')),
      );
  });
  it('separates owners from household members and enforces filtered queries', async () => {
    await assertSucceeds(getDoc(doc(andrew(), 'items/private')));
    await assertFails(getDoc(doc(karen(), 'items/private')));
    await assertSucceeds(getDoc(doc(karen(), 'items/shared')));
    await assertFails(getDocs(collection(karen(), 'items')));
    await assertSucceeds(
      getDocs(
        query(
          collection(karen(), 'items'),
          where('householdId', '==', 'blevins'),
          where('scope', '==', 'household'),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(andrew(), 'items'),
          where('householdId', '==', 'blevins'),
          where('scope', '==', 'private'),
          where('ownerPersonIds', 'array-contains', 'andrew'),
        ),
      ),
    );
  });
  it('denies self-enrollment, membership edits and person impersonation', async () => {
    const db = andrew();
    await assertFails(updateDoc(doc(db, 'users/andrew-uid'), { householdIds: ['other'] }));
    await assertFails(updateDoc(doc(db, 'users/andrew-uid'), { personId: 'karen' }));
    await assertFails(setDoc(doc(db, 'users/new'), { personId: 'andrew' }));
    await assertFails(updateDoc(doc(db, 'households/blevins'), { memberUids: ['attacker'] }));
    await assertFails(updateDoc(doc(db, 'people/andrew'), { uid: 'attacker' }));
    await assertSucceeds(updateDoc(doc(db, 'people/karen'), { status: 'archived' }));
    await assertSucceeds(updateDoc(doc(db, 'users/andrew-uid'), { defaultContext: 'computer' }));
  });
  it('credentials and undeclared collections are always denied', async () => {
    for (const path of ['credentials/andrew-uid', 'anything/one']) {
      await assertFails(getDoc(doc(andrew(), path)));
      await assertFails(setDoc(doc(andrew(), path), { value: 1 }));
    }
  });
});
describe('item mutations and permanent log', () => {
  it('allows only a valid creator and version increment; other fields remain independent', async () => {
    const ref = doc(andrew(), 'items/private');
    await assertFails(updateDoc(ref, { title: 'Changed' }));
    await assertFails(updateDoc(ref, { version: 2, createdBy: 'someone-else' }));
    await assertFails(updateDoc(ref, { version: 2, createdAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { version: 2, effort: '20 minutes' }));
    await assertFails(updateDoc(ref, { version: 2, readiness: 'ready' }));
    await assertSucceeds(updateDoc(ref, { title: 'Changed', version: increment(1) }));
    await assertSucceeds(updateDoc(ref, { nextAction: 'Call', version: increment(1) }));
    expect((await getDoc(ref)).data()).toMatchObject({
      title: 'Changed',
      nextAction: 'Call',
      version: 3,
    });
  });
  it('requires the capture log in the same atomic create', async () => {
    const db = andrew();
    await assertFails(setDoc(doc(db, 'items/no-log'), item()));
    const batch = writeBatch(db);
    batch.set(doc(db, 'items/new'), item({ status: 'inbox' }));
    batch.set(doc(db, 'items/new/log/capture'), {
      at: createdAt,
      by: 'andrew-uid',
      kind: 'capture',
      text: 'Original words',
    });
    await assertSucceeds(batch.commit());
    const forged = writeBatch(db);
    forged.set(doc(db, 'items/forged'), item());
    forged.set(doc(db, 'items/forged/log/capture'), {
      at: createdAt,
      by: 'karen-uid',
      kind: 'capture',
      text: 'Forged',
    });
    await assertFails(forged.commit());
  });
  it('enforces create-only logs, own attribution and no item delete', async () => {
    const db = andrew();
    await assertFails(updateDoc(doc(db, 'items/private/log/capture'), { text: 'Rewritten' }));
    await assertFails(deleteDoc(doc(db, 'items/private/log/capture')));
    await assertFails(deleteDoc(doc(db, 'items/private')));
    await assertFails(
      setDoc(doc(db, 'items/private/log/forged'), {
        at: createdAt,
        by: 'agent',
        kind: 'note',
        text: 'Forged',
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, 'items/private/log/note'), {
        at: createdAt,
        by: 'andrew-uid',
        kind: 'note',
        text: 'A note',
      }),
    );
    await assertFails(
      setDoc(doc(karen(), 'items/private/log/note'), {
        at: createdAt,
        by: 'karen-uid',
        kind: 'note',
        text: 'Not authorized',
      }),
    );
  });
  it('edits array entries through atomic remove/add without rewriting the whole array', async () => {
    const db = andrew(),
      ref = doc(db, 'items/private'),
      old = { id: 's1', text: 'Buy caulk', done: false },
      other = { id: 's2', text: 'Clean surface', done: false };
    await assertSucceeds(updateDoc(ref, { steps: arrayUnion(old), version: increment(1) }));
    await assertSucceeds(updateDoc(ref, { steps: arrayUnion(other), version: increment(1) }));
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        await transaction.get(ref);
        transaction.update(ref, { steps: arrayRemove(old) });
        transaction.update(ref, {
          steps: arrayUnion({ ...old, done: true }),
          version: increment(1),
        });
      }),
    );
    expect((await getDoc(ref)).data()?.steps).toEqual([other, { ...old, done: true }]);
  });
  it('rejects extra nesting and visibility mismatches', async () => {
    await assertSucceeds(
      updateDoc(doc(andrew(), 'items/private'), {
        parentId: 'shared',
        scope: 'household',
        version: increment(1),
      }),
    );
    await assertFails(
      updateDoc(doc(andrew(), 'items/shared'), { parentId: 'private', version: increment(1) }),
    );
  });
  it('validates newly added nested entries and recurrence types', async () => {
    const ref = doc(andrew(), 'items/private');
    await assertFails(
      updateDoc(ref, {
        steps: arrayUnion({ id: 'x', text: 'Step', done: 'yes' }),
        version: increment(1),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        links: arrayUnion({ id: 'l', label: 'Bad URL', url: 'javascript:alert(1)', kind: 'chat' }),
        version: increment(1),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        recurrence: { kind: 'afterCompletion', intervalDays: -1 },
        version: increment(1),
      }),
    );
  });
  it('converts a question into a decision atomically under the same rules', async () => {
    const db = andrew(),
      ref = doc(db, 'items/private');
    const question = { id: 'q1', text: 'Which material?', createdAt };
    const decision = {
      id: 'd1',
      text: 'Silicone',
      decidedAt: createdAt,
      fromQuestionId: 'q1',
      rationale: question.text,
    };
    await assertSucceeds(
      updateDoc(ref, { questions: arrayUnion(question), version: increment(1) }),
    );
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        await transaction.get(ref);
        transaction.update(ref, {
          questions: arrayRemove(question),
          decisions: arrayUnion(decision),
          version: increment(1),
        });
      }),
    );
    expect((await getDoc(ref)).data()).toMatchObject({ questions: [], decisions: [decision] });
  });
});
describe('proposal checkboxes are not authoritative payloads', () => {
  it('allows checkbox edits and discard, but denies value edits even in later rows', async () => {
    const ref = doc(andrew(), 'proposals/p1'),
      proposal = (await getDoc(ref)).data()!;
    const checked = proposal.changes.map((row: Record<string, unknown>) => ({
      ...row,
      checked: false,
    }));
    await assertSucceeds(updateDoc(ref, { changes: checked }));
    await assertFails(
      updateDoc(ref, {
        changes: checked.map((row: Record<string, unknown>, i: number) =>
          i === 1 ? { ...row, value: 'Malicious rewrite' } : row,
        ),
      }),
    );
    await assertFails(updateDoc(ref, { source: 'planner-ai' }));
    await assertFails(updateDoc(ref, { status: 'applied' }));
    await assertSucceeds(updateDoc(ref, { status: 'discarded' }));
    await assertFails(updateDoc(ref, { status: 'pending' }));
  });
  it('denies unauthorized readers and client proposal creation', async () => {
    await assertFails(getDoc(doc(karen(), 'proposals/p1')));
    await assertFails(setDoc(doc(andrew(), 'proposals/new'), { targetItemId: 'private' }));
  });
});
