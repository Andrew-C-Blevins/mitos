import { generateKeyBetween } from 'fractional-indexing';
import type { Item } from '@/lib/types';

// Reorder within the complete sibling group, even when a list filter is active.
export function movedSortKey(items: Item[], item: Item, destination: string): string {
  const siblings = items
    .filter(
      (other) =>
        other.id !== item.id && other.status === 'active' && other.parentId === item.parentId,
    )
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  const index =
    destination === 'end'
      ? siblings.length
      : siblings.findIndex((other) => other.id === destination);
  if (index < 0) throw new Error('That item is no longer available. Choose a new position.');
  return generateKeyBetween(siblings[index - 1]?.sortKey ?? null, siblings[index]?.sortKey ?? null);
}
