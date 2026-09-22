'use client';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  increment,
  Timestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  runTransaction,
  getDocs,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebase } from './firebase';
import { decode, encode } from '../codec';
import { captureItem, validateItem } from '@/lib/domain/items';
import { completionPatch } from '@/lib/domain/rules';
import { equal } from '@/lib/domain/proposals';
import { newId } from '@/lib/domain/ids';
import type { Item, LogEntry, Viewer, Section, SectionEntry } from '@/lib/types';

export function subscribeItems(
  viewer: Viewer,
  onItems: (items: Item[], pending: boolean) => void,
  onError: (error: Error) => void,
) {
  const { db } = getFirebase();
  const buckets = new Map<string, Item[]>(),
    pending = new Map<string, boolean>();
  const queries = viewer.householdIds.flatMap((id) => [
    query(
      collection(db, 'items'),
      where('householdId', '==', id),
      where('scope', '==', 'household'),
      orderBy('sortKey'),
    ),
    query(
      collection(db, 'items'),
      where('householdId', '==', id),
      where('ownerPersonIds', 'array-contains', viewer.personId),
      where('scope', '==', 'private'),
      orderBy('sortKey'),
    ),
  ]);
  const stops = queries.map((q, index) =>
    onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        try {
          buckets.set(
            String(index),
            snapshot.docs.map((doc) => validateItem(decode<Item>(doc.id, doc.data()))),
          );
          pending.set(String(index), snapshot.metadata.hasPendingWrites);
          onItems(
            [...new Map([...buckets.values()].flat().map((item) => [item.id, item])).values()].sort(
              (a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0),
            ),
            [...pending.values()].some(Boolean),
          );
        } catch (error) {
          onError(error as Error);
        }
      },
      onError,
    ),
  );
  return () => stops.forEach((stop) => stop());
}
export function subscribeItem(
  id: string,
  next: (item: Item | null) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    doc(getFirebase().db, 'items', id),
    (snapshot) => {
      try {
        next(snapshot.exists() ? validateItem(decode<Item>(snapshot.id, snapshot.data())) : null);
      } catch (caught) {
        error(caught as Error);
      }
    },
    error,
  );
}
export function capture(text: string, viewer: Viewer, onError: (error: Error) => void): string {
  const { db } = getFirebase();
  const ref = doc(collection(db, 'items'));
  const now = new Date().toISOString(),
    item = captureItem(text, viewer, now, ref.id);
  const batch = writeBatch(db);
  batch.set(ref, encode(item, Timestamp.fromDate));
  batch.set(doc(ref, 'log', 'capture'), {
    at: Timestamp.fromDate(new Date(now)),
    by: viewer.uid,
    kind: 'capture',
    text,
  });
  // Firestore queues offline and emits the optimistic snapshot immediately.
  // Do not await server acknowledgement to dismiss the capture sheet.
  void batch.commit().catch(onError);
  return ref.id;
}
type EditableFields = Pick<
  Item,
  | 'title'
  | 'intent'
  | 'outcome'
  | 'nextAction'
  | 'status'
  | 'scope'
  | 'ownerPersonIds'
  | 'category'
  | 'effort'
  | 'focus'
  | 'contexts'
  | 'businessHours'
  | 'dueDate'
  | 'targetDate'
  | 'snoozeUntil'
  | 'availableFrom'
  | 'sortKey'
  | 'recurrence'
  | 'completedAt'
>;
export function updateFields(
  item: Item,
  fields: Partial<{ [K in keyof EditableFields]: EditableFields[K] | null }>,
  viewer: Viewer,
  logText?: string,
) {
  const candidate = { ...item } as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) delete candidate[key];
    else candidate[key] = value;
  }
  validateItem(candidate);
  const now = Timestamp.now(),
    batch = writeBatch(getFirebase().db),
    ref = doc(getFirebase().db, 'items', item.id);
  const patch = encode(fields, Timestamp.fromDate);
  for (const [key, value] of Object.entries(fields)) if (value === null) patch[key] = deleteField();
  batch.update(ref, { ...patch, version: increment(1), updatedAt: now });
  if (logText)
    batch.set(doc(collection(ref, 'log')), {
      at: now,
      by: viewer.uid,
      kind: 'status',
      text: logText,
    });
  return batch.commit();
}
export function complete(item: Item, viewer: Viewer) {
  return updateFields(
    item,
    completionPatch(
      item,
      new Date().toISOString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    viewer,
    item.recurrence ? 'Completed this occurrence.' : 'Completed.',
  );
}
export function addEntry(item: Item, section: Section, entry: SectionEntry) {
  validateItem({ ...item, [section]: [...item[section], entry] });
  const batch = writeBatch(getFirebase().db),
    ref = doc(getFirebase().db, 'items', item.id);
  batch.update(ref, {
    [section]: arrayUnion(encodeNested(entry)),
    version: increment(1),
    updatedAt: Timestamp.now(),
  });
  return batch.commit();
}
function encodeNested(entry: SectionEntry) {
  return { ...encode(entry, Timestamp.fromDate), id: entry.id };
}
export function editEntry(
  itemId: string,
  section: Section,
  before: SectionEntry,
  after?: SectionEntry,
) {
  const { db } = getFirebase(),
    ref = doc(db, 'items', itemId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Item no longer exists.');
    const item = decode<Item>(snapshot.id, snapshot.data());
    const current = item[section].find((row) => row.id === before.id);
    if (!equal(current, before))
      throw new Error(
        'This entry changed on another device. Read the latest version and try again.',
      );
    const rows = item[section].filter((row) => row.id !== before.id);
    if (after) rows.push(after as never);
    validateItem({ ...item, [section]: rows });
    transaction.update(ref, { [section]: arrayRemove(encodeNested(before)) });
    transaction.update(ref, {
      ...(after ? { [section]: arrayUnion(encodeNested(after)) } : {}),
      version: increment(1),
      updatedAt: Timestamp.now(),
    });
  });
}
export function answerQuestion(
  itemId: string,
  question: Item['questions'][number],
  answer: string,
) {
  const { db } = getFirebase(),
    ref = doc(db, 'items', itemId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref),
      item = decode<Item>(snapshot.id, snapshot.data()!);
    if (
      !equal(
        item.questions.find((row) => row.id === question.id),
        question,
      )
    )
      throw new Error('This question changed. Read it again before answering.');
    const decision = {
      id: newId(),
      text: answer.trim(),
      decidedAt: new Date().toISOString(),
      fromQuestionId: question.id,
      rationale: question.text,
    };
    validateItem({
      ...item,
      questions: item.questions.filter((row) => row.id !== question.id),
      decisions: [...item.decisions, decision],
    });
    transaction.update(ref, {
      questions: arrayRemove(encodeNested(question)),
      decisions: arrayUnion(encodeNested(decision)),
      version: increment(1),
      updatedAt: Timestamp.now(),
    });
  });
}
export function addNote(itemId: string, text: string, viewer: Viewer) {
  if (!text.trim() || text.length > 4000) throw new Error('A note needs 1–4,000 characters.');
  const { db } = getFirebase(),
    ref = doc(db, 'items', itemId),
    batch = writeBatch(db);
  batch.set(doc(collection(ref, 'log')), {
    at: Timestamp.now(),
    by: viewer.uid,
    kind: 'note',
    text: text.trim(),
  });
  batch.update(ref, { updatedAt: Timestamp.now(), version: increment(1) });
  return batch.commit();
}
export function subscribeLog(
  itemId: string,
  next: (rows: LogEntry[], cursor?: QueryDocumentSnapshot) => void,
  error: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(getFirebase().db, 'items', itemId, 'log'), orderBy('at', 'desc'), limit(20)),
    (snapshot) =>
      next(
        snapshot.docs.map((doc) => decode<LogEntry>(doc.id, doc.data())),
        snapshot.docs.at(-1),
      ),
    error,
  );
}
export async function olderLog(itemId: string, cursor: QueryDocumentSnapshot) {
  const snapshot = await getDocs(
    query(
      collection(getFirebase().db, 'items', itemId, 'log'),
      orderBy('at', 'desc'),
      startAfter(cursor),
      limit(20),
    ),
  );
  return {
    rows: snapshot.docs.map((doc) => decode<LogEntry>(doc.id, doc.data())),
    cursor: snapshot.docs.at(-1),
  };
}
