import { generateKeyBetween } from 'fractional-indexing';
import type { Item } from '@/lib/types';

// Reorder within the complete sibling group, even when a list filter is active.
export function movedSortKey(
  items: Item[],
  item: Item,
  destination: string | { beforeId: string | null; afterId: string | null },
): string {
  const siblings = items
    .filter(
      (other) =>
        other.id !== item.id && other.status === 'active' && other.parentId === item.parentId,
    )
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  const beforeId =
    typeof destination === 'string'
      ? destination === 'end'
        ? null
        : destination
      : destination.beforeId;
  const afterId = typeof destination === 'string' ? null : destination.afterId;
  const beforeIndex = beforeId ? siblings.findIndex((other) => other.id === beforeId) : -1;
  const afterIndex = afterId ? siblings.findIndex((other) => other.id === afterId) : -1;
  if (
    (beforeId && beforeIndex < 0) ||
    (afterId && afterIndex < 0) ||
    (beforeId && afterId && afterIndex >= beforeIndex)
  ) {
    throw new Error('The list changed. Try moving the to-do again.');
  }
  // At the bottom of a filtered view, place just after the last visible sibling,
  // preserving the order of hidden siblings rather than jumping to the global end.
  const index = beforeId ? beforeIndex : afterId ? afterIndex + 1 : siblings.length;
  return generateKeyBetween(siblings[index - 1]?.sortKey ?? null, siblings[index]?.sortKey ?? null);
}
