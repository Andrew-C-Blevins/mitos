'use client';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';
import { decode } from '../codec';
import type { Person } from '@/lib/types';
export function setPersonStatus(id: string, status: Person['status']) {
  return updateDoc(doc(getFirebase().db, 'people', id), { status });
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
