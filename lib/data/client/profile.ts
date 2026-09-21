'use client';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { Context } from '@/lib/types';

export function setDefaultContext(uid: string, context: Context | '') {
  return updateDoc(doc(getFirebase().db, 'users', uid), {
    defaultContext: context || deleteField(),
  });
}
