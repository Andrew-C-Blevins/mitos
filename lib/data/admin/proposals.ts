import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdmin } from './firebase';
import { getItem } from './items';
import { encode } from '../codec';
import type { Proposal, Viewer } from '@/lib/types';

// Future AI/agent writers are restricted to this adapter. No active endpoints yet.
export async function createProposal(
  proposal: Omit<Proposal, 'id' | 'status' | 'createdAt'>,
  viewer: Viewer,
): Promise<string> {
  if (!proposal.targetItemId) throw new Error('New-item proposal authorization is deferred to M3.');
  await getItem(proposal.targetItemId, viewer);
  if (!proposal.changes.length || proposal.changes.length > 40)
    throw new Error('A proposal needs 1–40 changes.');
  const ref = getAdmin().db.collection('proposals').doc();
  await ref.create(
    encode(
      {
        ...proposal,
        status: 'pending',
        createdAt: new Date().toISOString(),
        changes: proposal.changes.map((change) => ({
          ...change,
          checked: proposal.confidence === 'low' ? false : change.checked,
        })),
      },
      Timestamp.fromDate,
    ),
  );
  return ref.id;
}
