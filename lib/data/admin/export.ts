import 'server-only';
import { getAdmin } from './firebase';
import { listItems } from './items';
import { decode } from '../codec';
import type { Viewer } from '@/lib/types';

export async function exportData(viewer: Viewer) {
  const { db } = getAdmin();
  const [items, user, households, people] = await Promise.all([
    listItems(viewer),
    db.doc(`users/${viewer.uid}`).get(),
    Promise.all(viewer.householdIds.map((id) => db.doc(`households/${id}`).get())),
    Promise.all(
      viewer.householdIds.map((id) => db.collection('people').where('householdId', '==', id).get()),
    ),
  ]);
  // Only read histories for items returned by the authorized item reader.
  const records = await Promise.all(
    items.map(async (item) => {
      const [log, proposals] = await Promise.all([
        db.collection(`items/${item.id}/log`).orderBy('at').get(),
        db.collection('proposals').where('targetItemId', '==', item.id).get(),
      ]);
      return {
        ...item,
        log: log.docs.map((entry) => decode(entry.id, entry.data())),
        proposals: proposals.docs.map((entry) => decode(entry.id, entry.data())),
      };
    }),
  );
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    user: decode(user.id, user.data()!),
    households: households.map((entry) => decode(entry.id, entry.data()!)),
    people: people.flatMap((snapshot) =>
      snapshot.docs.map((entry) => decode(entry.id, entry.data())),
    ),
    items: records,
  };
}
