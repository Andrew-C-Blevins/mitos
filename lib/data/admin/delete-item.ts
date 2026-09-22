import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdmin } from './firebase';
import { AuthError } from '@/lib/auth/require-auth';
import { canAccess, validateItem } from '@/lib/domain/items';
import { decode } from '../codec';
import type { Item, Viewer } from '@/lib/types';

// Human-only, explicitly confirmed deletion. The API/AI import gate permits this
// adapter only in the authenticated DELETE route, never in an agent or AI route.
export async function deleteItem(id: string, expectedVersion: number, viewer: Viewer) {
  const { db } = getAdmin();
  await db.runTransaction(async (transaction) => {
    const ref = db.collection('items').doc(id);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AuthError('Item not found.', 404);
    const item = validateItem(decode<Item>(snapshot.id, snapshot.data()!));
    const household = await transaction.get(db.collection('households').doc(item.householdId));
    if (!canAccess(item, viewer) || !household.data()?.memberUids?.includes(viewer.uid))
      throw new AuthError('Item not found.', 404);
    if (item.version !== expectedVersion)
      throw new AuthError(
        'This item changed. Close this confirmation, review it, and try again.',
        409,
      );

    // Read every history page, not just the 20 entries currently shown in the UI.
    // A single transaction either removes all item data or leaves all of it intact.
    const logs = await transaction.get(ref.collection('log'));
    const proposals = await transaction.get(
      db.collection('proposals').where('targetItemId', '==', id),
    );
    const children = await transaction.get(db.collection('items').where('parentId', '==', id));
    // Separate child to-dos survive and become standalone items. Leaving a
    // dangling parentId would prevent their next edit under validParent rules.
    children.forEach((child) =>
      transaction.update(child.ref, {
        parentId: FieldValue.delete(),
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
    logs.forEach((entry) => transaction.delete(entry.ref));
    proposals.forEach((proposal) => transaction.delete(proposal.ref));
    transaction.delete(ref);
  });
}
