/** Storage-independent description of a drop, using stable ids instead of indexes. */
export interface ListMove {
  id: string;
  beforeId: string | null;
  afterId: string | null;
}

export function moveInList<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
    throw new Error('The list changed. Try moving the entry again.');
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function describeMove<T>(
  items: readonly T[],
  index: number,
  getId: (item: T) => string,
): ListMove {
  return {
    id: getId(items[index]),
    beforeId: index + 1 < items.length ? getId(items[index + 1]) : null,
    afterId: index > 0 ? getId(items[index - 1]) : null,
  };
}
