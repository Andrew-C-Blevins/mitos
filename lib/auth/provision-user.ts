import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdmin } from '@/lib/data/admin/firebase';
import { AuthError } from './require-auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

export async function provisionUser(identity: DecodedIdToken) {
  const email = identity.email?.toLowerCase();
  const personId =
    email === process.env.ANDREW_EMAIL?.toLowerCase()
      ? 'andrew'
      : email === process.env.KAREN_EMAIL?.toLowerCase()
        ? 'karen'
        : undefined;
  if (!personId) throw new AuthError('No person record is mapped to this account.', 403);
  const { db } = getAdmin();
  return db.runTransaction(async (transaction) => {
    const userRef = db.doc(`users/${identity.uid}`),
      personRef = db.doc(`people/${personId}`),
      householdRef = db.doc('households/blevins');
    const [user, person, household] = await transaction.getAll(userRef, personRef, householdRef);
    if (
      !person.exists ||
      !household.exists ||
      !household.data()?.memberUids.includes(identity.uid) ||
      person.data()?.uid !== identity.uid
    )
      throw new AuthError('This account has not been seeded into the household.', 403);
    if (!user.exists)
      transaction.create(userRef, {
        email: identity.email,
        name: identity.name ?? person.data()!.name,
        personId,
        householdIds: ['blevins'],
        createdAt: Timestamp.now(),
      });
    return { personId, householdIds: ['blevins'] };
  });
}
