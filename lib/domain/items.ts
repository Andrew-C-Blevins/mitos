import { generateKeyBetween } from 'fractional-indexing';
import { itemSchema, type Item, type Viewer } from '@/lib/types';

export function captureItem(
  text: string,
  viewer: Viewer,
  now: string,
  id: string,
  sortKey = generateKeyBetween(null, null) + id.replace(/[^0-9A-Za-z]/g, '') + '1',
): Item {
  return itemSchema.parse({
    id,
    title: text.trim(),
    status: 'inbox',
    scope: 'private',
    householdId: viewer.householdIds[0],
    ownerPersonIds: [viewer.personId],
    createdBy: viewer.uid,
    category: 'personal',
    effort: 'quick',
    focus: 'normal',
    contexts: [],
    businessHours: false,
    needs: [],
    questions: [],
    decisions: [],
    steps: [],
    links: [],
    sortKey,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}
export function canAccess(item: Item, viewer: Viewer): boolean {
  return (
    viewer.householdIds.includes(item.householdId) &&
    (item.scope === 'household' || item.ownerPersonIds.includes(viewer.personId))
  );
}
export function validateItem(item: unknown): Item {
  return itemSchema.parse(item);
}
export function validateParent(item: Item, parent?: Item): void {
  if (
    item.parentId &&
    (!parent ||
      parent.id !== item.parentId ||
      parent.parentId ||
      parent.id === item.id ||
      parent.householdId !== item.householdId ||
      parent.scope !== item.scope ||
      JSON.stringify([...parent.ownerPersonIds].sort()) !==
        JSON.stringify([...item.ownerPersonIds].sort()))
  ) {
    throw new Error('A child needs a top-level parent with the same visibility and owners.');
  }
}
export { applyProposal } from './proposals';
