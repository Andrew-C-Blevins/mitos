import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdmin } from './firebase';
import { decode } from '../codec';
import { AuthError } from '@/lib/auth/require-auth';
import { validatePersonChange, type PersonChange } from '@/lib/domain/people';
import type { Household, Person, Viewer } from '@/lib/types';

export async function changePerson(id: string, change: PersonChange, viewer: Viewer) {
  const { db } = getAdmin();
  await db.runTransaction(async (transaction) => {
    const ref = db.doc(`people/${id}`),
      snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AuthError('Person not found.', 404);
    const person = decode<Person>(id, snapshot.data()!);
    if (!viewer.householdIds.includes(person.householdId))
      throw new AuthError('Person not found.', 404);
    const householdRef = db.doc(`households/${person.householdId}`);
    const householdDoc = await transaction.get(householdRef);
    const peopleDocs = await transaction.get(
      db.collection('people').where('householdId', '==', person.householdId),
    );
    const household = decode<Household>(householdDoc.id, householdDoc.data()!);
    const people = peopleDocs.docs.map((doc) => decode<Person>(doc.id, doc.data()));
    try {
      validatePersonChange(household, people, person, viewer, change);
    } catch (error) {
      throw new AuthError((error as Error).message, 403);
    }
    if (change.action === 'delete') {
      const references = await transaction.get(
        db.collection('items').where('ownerPersonIds', 'array-contains', id).limit(1),
      );
      if (!references.empty)
        throw new AuthError(
          'This person is part of item history. Keep them archived instead.',
          409,
        );
      transaction.delete(ref);
    } else if (change.action === 'color') {
      transaction.update(ref, { color: change.value.toLowerCase() });
    } else if (change.action === 'role') {
      transaction.update(householdRef, {
        adminUids:
          change.value === 'admin'
            ? FieldValue.arrayUnion(person.uid)
            : FieldValue.arrayRemove(person.uid),
      });
    } else {
      transaction.update(ref, {
        status: change.value,
        archivedAt:
          change.value === 'archived' ? FieldValue.serverTimestamp() : FieldValue.delete(),
      });
      if (person.uid)
        transaction.update(householdRef, {
          memberUids:
            change.value === 'active'
              ? FieldValue.arrayUnion(person.uid)
              : FieldValue.arrayRemove(person.uid),
          ...(change.value === 'archived' ? { adminUids: FieldValue.arrayRemove(person.uid) } : {}),
        });
    }
  });
}
