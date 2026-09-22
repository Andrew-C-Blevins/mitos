import { describe, expect, it } from 'vitest';
import { captureItem, canAccess, validateItem, validateParent } from '@/lib/domain/items';
import { applyProposal, equal } from '@/lib/domain/proposals';
import { migrateTask } from '@/lib/domain/migration';
import { item, viewer, now, context } from './fixtures';
import type { Change } from '@/lib/types';
import { validateCapture } from '@/lib/domain/input';
import { movedSortKey } from '@/lib/domain/ordering';
describe('capture, validation and authorization', () => {
  it('accepts a long pasted checklist without forcing it into the title or losing the source', () => {
    const raw =
      '  # Submit the claim\r\n' +
      Array.from({ length: 20 }, (_, i) => `${i + 1}. ${'Instructions '.repeat(30)}`).join('\r\n') +
      '\r\n';
    expect(validateCapture(raw)).toBe(raw);
    expect(captureItem(raw, viewer, now, 'long').title).toBe('Submit the claim');
    expect(captureItem('x'.repeat(1000), viewer, now, 'prose').title.length).toBeLessThanOrEqual(
      160,
    );
    expect(() => captureItem('x'.repeat(50001), viewer, now, 'too-long')).toThrow('50,000');
  });
  it('moves to a chosen sibling position, including the bottom, without changing other items', () => {
    const first = item({ id: 'first', sortKey: 'a0' }),
      second = item({ id: 'second', sortKey: 'a1' }),
      last = item({ id: 'last', sortKey: 'a2' });
    const rows = [first, second, last];
    expect(movedSortKey(rows, last, 'second') > first.sortKey).toBe(true);
    expect(movedSortKey(rows, last, 'second') < second.sortKey).toBe(true);
    expect(movedSortKey(rows, first, 'end') > last.sortKey).toBe(true);
    expect(() => movedSortKey(rows, first, 'missing')).toThrow();
    expect(rows[1].sortKey).toBe('a1');
  });
  it('captures privately with the exact default fields and no invented intent', () => {
    const saved = captureItem('  Buy caulk  ', viewer, now, 'capture-id');
    expect(saved).toMatchObject({
      title: 'Buy caulk',
      status: 'inbox',
      scope: 'private',
      ownerPersonIds: ['andrew'],
      category: 'personal',
      version: 1,
    });
    expect(saved.intent).toBeUndefined();
  });
  it('rejects bad dates, enums, unowned private items and unsafe URLs', () => {
    for (const patch of [
      { dueDate: '2026-02-30' },
      { category: 'shopping' },
      { ownerPersonIds: [] },
      { links: [{ id: 'x', label: 'x', kind: 'chat', url: 'javascript:alert(1)' }] },
    ])
      expect(() => validateItem({ ...item(), ...patch })).toThrow();
  });
  it('does not grant private access through household membership', () => {
    expect(canAccess(item(), viewer)).toBe(true);
    expect(canAccess(item(), { ...viewer, personId: 'karen' })).toBe(false);
    expect(canAccess(item({ scope: 'household' }), { ...viewer, personId: 'karen' })).toBe(true);
    expect(canAccess(item(), { ...viewer, householdIds: [] })).toBe(false);
  });
  it('permits one nested level with matching visibility', () => {
    const parent = item({ id: 'parent' }),
      child = item({ parentId: 'parent' });
    expect(() => validateParent(child, parent)).not.toThrow();
    expect(() => validateParent(child, { ...parent, parentId: 'grandparent' })).toThrow();
    expect(() => validateParent(child, { ...parent, scope: 'household' })).toThrow();
  });
});
describe('proposal preconditions', () => {
  const change: Change = {
    id: 'c',
    label: 'Set next action',
    class: 'conditional',
    op: 'set',
    path: 'nextAction',
    previousValue: undefined,
    value: 'Buy caulk',
    checked: true,
  };
  it('allows unrelated changes, flags conflicting values without changing them', () => {
    expect(
      applyProposal(item({ title: 'New title', version: 8 }), [change], context),
    ).toMatchObject({
      item: { title: 'New title', nextAction: 'Buy caulk', version: 9 },
      staleIds: [],
    });
    expect(applyProposal(item({ nextAction: 'Ask Karen' }), [change], context)).toMatchObject({
      staleIds: ['c'],
      appliedIds: [],
      item: { nextAction: 'Ask Karen', version: 1 },
    });
  });
  it('deduplicates commutative ids and checks transition side effects', () => {
    const question = { id: 'q', text: 'Which caulk?', createdAt: now };
    const add: Change = {
      id: 'add',
      label: 'Question',
      class: 'commutative',
      op: 'add',
      path: 'questions',
      value: question,
      checked: true,
    };
    const result = applyProposal(item(), [add, add], context);
    expect(result.item.questions).toHaveLength(1);
    const complete: Change = {
      ...add,
      id: 'done',
      class: 'transition',
      op: 'transition',
      path: 'status',
      value: 'done',
    };
    expect(
      applyProposal(
        item({ recurrence: { kind: 'afterCompletion', intervalDays: 7 } }),
        [complete],
        context,
      ).item,
    ).toMatchObject({ status: 'active', availableFrom: '2026-09-28' });
    expect(applyProposal(item({ status: 'done' }), [complete], context).staleIds).toEqual(['done']);
  });
  it('forbids changing system fields, unsafe class/path combinations and unchecked rows', () => {
    expect(() =>
      applyProposal(item(), [{ ...change, path: 'createdBy', value: 'other' }], context),
    ).toThrow();
    expect(() =>
      applyProposal(
        item(),
        [{ ...change, class: 'commutative', op: 'add', path: 'title' }],
        context,
      ),
    ).toThrow();
    expect(applyProposal(item(), [{ ...change, checked: false }], context).appliedIds).toEqual([]);
    expect(equal({ b: 1, a: 2 }, { a: 2, b: 1 })).toBe(true);
  });
});
describe('legacy migration', () => {
  const task = {
    id: 'p1',
    title: 'Original title',
    detail: 'Original detail',
    category: 'reading',
    assignee: 'andrew',
    done: false,
  };
  it('preserves title, detail order, status, list defaults and never invents dates', () => {
    const result = migrateTask(task, 'personal-projects', viewer, now, null);
    expect(result.item).toMatchObject({
      title: task.title,
      scope: 'private',
      ownerPersonIds: ['andrew'],
      status: 'active',
      category: 'personal',
    });
    expect(result.log.slice(0, 2).map((row) => [row.kind, row.text])).toEqual([
      ['capture', task.title],
      ['note', task.detail],
    ]);
    expect(result.item.completedAt).toBeUndefined();
    expect(
      migrateTask({ ...task, done: true }, 'home-projects', viewer, now, null).item,
    ).toMatchObject({ status: 'done', scope: 'household', ownerPersonIds: ['andrew', 'karen'] });
  });
  it('holds ambiguous categories and Diana items for review, preserving attribution', () => {
    expect(
      migrateTask({ ...task, category: 'shopping' }, 'personal-projects', viewer, now, null).review,
    ).toHaveLength(1);
    expect(
      migrateTask({ ...task, assignee: 'diana' }, 'personal-projects', viewer, now, null).review,
    ).toHaveLength(1);
    expect(
      migrateTask({ ...task, assignee: 'diana' }, 'home-projects', viewer, now, null, {
        dianaActionable: true,
      }).item,
    ).toMatchObject({ ownerPersonIds: [], historicalOwnerNames: ['Diana'], status: 'active' });
    expect(
      migrateTask({ ...task, assignee: 'diana', done: true }, 'home-projects', viewer, now, null)
        .item,
    ).toMatchObject({ status: 'done', ownerPersonIds: ['diana'] });
  });
});
