import { describe, expect, it } from 'vitest';
import { movedSortKey } from '@/lib/domain/ordering';
import { describeMove, moveInList } from '@/components/ui/sortable-list/order';
import { item } from './fixtures';

describe('drag drop order', () => {
  const rows = ['a', 'b', 'c', 'd'].map((id, i) => item({ id, sortKey: `a${i}` }));
  it('describes an upward or downward move with stable neighbors, without mutating input', () => {
    const next = moveInList(rows, 0, 2);
    expect(next.map((row) => row.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(describeMove(next, 2, (row) => row.id)).toEqual({
      id: 'a',
      beforeId: 'd',
      afterId: 'c',
    });
    expect(describeMove(moveInList(rows, 3, 0), 0, (row) => row.id)).toEqual({
      id: 'd',
      beforeId: 'a',
      afterId: null,
    });
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(() => moveInList(rows, 4, 0)).toThrow();
    expect(() => moveInList(rows, 0, -1)).toThrow();
  });
  it('keeps hidden siblings ordered when moving to the bottom of a filtered list', () => {
    // The visible list is a,c; b and d are filtered out.
    const key = movedSortKey(rows, rows[0], { beforeId: null, afterId: 'c' });
    expect(key > rows[2].sortKey && key < rows[3].sortKey).toBe(true);
    expect(rows.map((row) => row.sortKey)).toEqual(['a0', 'a1', 'a2', 'a3']);
    const up = movedSortKey(rows, rows[3], { beforeId: 'c', afterId: 'a' });
    expect(up > rows[1].sortKey && up < rows[2].sortKey).toBe(true);
  });
  it('rejects removed, completed, reparented, or reversed anchors instead of moving elsewhere', () => {
    expect(() => movedSortKey(rows, rows[0], { beforeId: 'missing', afterId: null })).toThrow();
    expect(() => movedSortKey(rows, rows[0], { beforeId: 'b', afterId: 'c' })).toThrow();
    expect(() =>
      movedSortKey(
        rows.map((r) => (r.id === 'c' ? { ...r, status: 'done' } : r)),
        rows[0],
        { beforeId: null, afterId: 'c' },
      ),
    ).toThrow();
    expect(() =>
      movedSortKey([...rows, item({ id: 'child', parentId: 'b', sortKey: 'a4' })], rows[0], {
        beforeId: 'child',
        afterId: null,
      }),
    ).toThrow();
  });
  it('orders children only within their parent without changing their relationship', () => {
    const children = rows.map((row) => ({ ...row, parentId: 'parent' }));
    const key = movedSortKey([...children, item({ id: 'parent', sortKey: 'a9' })], children[0], {
      beforeId: null,
      afterId: 'd',
    });
    expect(key > children[3].sortKey && key < 'a9').toBe(true);
    expect(children.every((child) => child.parentId === 'parent')).toBe(true);
  });
});
