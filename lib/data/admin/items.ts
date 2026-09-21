import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdmin } from './firebase';
import { decode, encode } from '../codec';
import { canAccess, validateItem } from '@/lib/domain/items';
import { applyProposal as applyChanges } from '@/lib/domain/proposals';
import { AuthError } from '@/lib/auth/require-auth';
import type { Item, Viewer, Proposal, Section } from '@/lib/types';

export async function getItem(id: string, viewer: Viewer): Promise<Item> {
  const doc = await getAdmin().db.collection('items').doc(id).get();
  if (!doc.exists) throw new AuthError('Item not found.', 404);
  const item = validateItem(decode<Item>(doc.id, doc.data()!));
  if (!canAccess(item, viewer)) throw new AuthError('Item not found.', 404);
  return item;
}
export async function listItems(viewer: Viewer): Promise<Item[]> {
  const { db } = getAdmin();
  const snapshots = await Promise.all([
    ...viewer.householdIds.map((id) =>
      db.collection('items').where('householdId', '==', id).where('scope', '==', 'household').get(),
    ),
    db
      .collection('items')
      .where('ownerPersonIds', 'array-contains', viewer.personId)
      .where('scope', '==', 'private')
      .get(),
  ]);
  return [
    ...new Map(
      snapshots
        .flatMap((snapshot) => snapshot.docs)
        .map((doc) => [doc.id, validateItem(decode<Item>(doc.id, doc.data()))]),
    ).values(),
  ].filter((item) => canAccess(item, viewer));
}

// Sole authoritative item write in the Admin item adapter. Not exposed to agents
// or AI, and no apply route is enabled before the later Review milestone.
export async function applyProposal(
  proposalId: string,
  checkedChangeIds: string[],
  viewer: Viewer,
  timeZone: string,
) {
  const { db } = getAdmin();
  return db.runTransaction(async (transaction) => {
    const ref = db.collection('proposals').doc(proposalId),
      snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AuthError('Proposal not found.', 404);
    const proposal = decode<Proposal>(snapshot.id, snapshot.data()!);
    if (!proposal.targetItemId)
      throw new Error(
        'New-item proposals are deferred until their authorization envelope is specified in M3.',
      );
    const itemRef = db.collection('items').doc(proposal.targetItemId),
      itemDoc = await transaction.get(itemRef);
    const item = validateItem(decode<Item>(itemDoc.id, itemDoc.data()!));
    if (!canAccess(item, viewer)) throw new AuthError('Proposal not found.', 404);
    if (proposal.status !== 'pending') throw new Error('This proposal is already resolved.');
    if (
      !checkedChangeIds.length ||
      checkedChangeIds.some((id) => !proposal.changes.some((change) => change.id === id))
    )
      throw new Error('Choose valid proposal changes.');
    const now = new Date().toISOString();
    const result = applyChanges(
      item,
      proposal.changes.map((change) => ({
        ...change,
        checked: checkedChangeIds.includes(change.id),
      })),
      { now, timeZone },
    );
    if (!canAccess(result.item, viewer))
      throw new Error('A proposal cannot remove the reviewer’s access.');
    if (result.appliedIds.length) {
      const sections: Section[] = ['needs', 'questions', 'decisions', 'steps', 'links'];
      const patch = encode(result.item, Timestamp.fromDate);
      // Scalars are updated by field. Existing arrays are changed with transforms.
      for (const section of sections) {
        delete patch[section];
        const oldRows = item[section],
          newRows = result.item[section];
        const removed = oldRows.filter(
          (row) => !newRows.some((other) => JSON.stringify(other) === JSON.stringify(row)),
        );
        const added = newRows.filter(
          (row) => !oldRows.some((other) => JSON.stringify(other) === JSON.stringify(row)),
        );
        if (removed.length)
          transaction.update(itemRef, {
            [section]: FieldValue.arrayRemove(
              ...removed.map((row) => ({ ...encode(row, Timestamp.fromDate), id: row.id })),
            ),
          });
        if (added.length)
          transaction.update(itemRef, {
            [section]: FieldValue.arrayUnion(
              ...added.map((row) => ({ ...encode(row, Timestamp.fromDate), id: row.id })),
            ),
          });
      }
      for (const key of Object.keys(item))
        if (key !== 'id' && !(key in result.item)) patch[key] = FieldValue.delete();
      transaction.update(itemRef, patch);
      transaction.create(itemRef.collection('log').doc(`proposal-${proposalId}`), {
        at: Timestamp.fromDate(new Date(now)),
        by: viewer.uid,
        kind: 'applied',
        text: proposal.changes
          .filter((change) => result.appliedIds.includes(change.id))
          .map((change) => change.label)
          .join('; '),
      });
    }
    const allApplied = result.appliedIds.length === proposal.changes.length;
    transaction.update(ref, {
      status: allApplied ? 'applied' : result.appliedIds.length ? 'partially-applied' : 'pending',
      changes: proposal.changes.map((change) => ({
        ...change,
        checked: result.staleIds.includes(change.id) ? false : checkedChangeIds.includes(change.id),
      })),
      ...(result.appliedIds.length
        ? { resolvedAt: Timestamp.fromDate(new Date(now)), resolvedBy: viewer.uid }
        : {}),
    });
    return { appliedIds: result.appliedIds, staleIds: result.staleIds, currentItem: result.item };
  });
}
