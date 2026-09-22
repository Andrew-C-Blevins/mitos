'use client';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { decode } from '../codec';
import type { Person, Household } from '@/lib/types';
import type { PersonChange } from '@/lib/domain/people';
export async function updatePerson(id: string, change: PersonChange) {
  const user = getFirebase().auth.currentUser;
  if (!user) throw new Error('Sign in before changing your profile.');
  const response = await fetch(`/api/people/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(change),
  });
  if (response.status === 401) throw new Error('Please sign out and sign in again, then retry.');
  if (!response.ok) throw new Error((await response.json()).error ?? 'Could not save.');
}
export function subscribeHousehold(
  id: string,
  next: (household: Household) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    doc(getFirebase().db, 'households', id),
    (snapshot) => {
      if (snapshot.exists()) next(decode<Household>(snapshot.id, snapshot.data()));
    },
    error,
  );
}
export function subscribePeople(
  householdId: string,
  next: (people: Person[]) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(getFirebase().db, 'people'), where('householdId', '==', householdId)),
    (snapshot) => next(snapshot.docs.map((doc) => decode<Person>(doc.id, doc.data()))),
    error,
  );
}
