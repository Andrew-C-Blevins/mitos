import { describe, it, expect } from 'vitest';
import { validatePersonChange } from '@/lib/domain/people';
import type { Household, Person, Viewer } from '@/lib/types';
const household: Household = {
  id: 'h',
  name: 'Home',
  memberUids: ['a', 'k'],
  adminUids: ['a'],
  createdAt: '2026-09-22T00:00:00Z',
};
const a: Person = {
  id: 'andrew',
  name: 'Andrew',
  uid: 'a',
  householdId: 'h',
  status: 'active',
  color: '#537a67',
  createdAt: household.createdAt,
};
const k: Person = { ...a, id: 'karen', name: 'Karen', uid: 'k', color: '#976783' };
const viewer: Viewer = { uid: 'a', personId: 'andrew', householdIds: ['h'] };
describe('household administration and personal colors', () => {
  it('allows only admins to change roles, archive or delete people', () => {
    const karen = { ...viewer, uid: 'k', personId: 'karen' };
    for (const change of [
      { action: 'role', value: 'admin' },
      { action: 'status', value: 'archived' },
      { action: 'delete' },
    ] as const)
      expect(() => validatePersonChange(household, [a, k], a, karen, change)).toThrow('admin');
    expect(() =>
      validatePersonChange(household, [a, k], k, viewer, { action: 'role', value: 'admin' }),
    ).not.toThrow();
  });
  it('protects the last active admin even if archived admins remain in the record', () => {
    for (const change of [
      { action: 'role', value: 'user' },
      { action: 'status', value: 'archived' },
      { action: 'delete' },
    ] as const)
      expect(() =>
        validatePersonChange(
          { ...household, adminUids: ['a', 'k'] },
          [a, { ...k, status: 'archived' }],
          a,
          viewer,
          change,
        ),
      ).toThrow('at least one');
    expect(() =>
      validatePersonChange({ ...household, adminUids: ['a', 'k'] }, [a, k], a, viewer, {
        action: 'role',
        value: 'user',
      }),
    ).not.toThrow();
  });
  it('permits own available colors, not another person’s profile or a duplicate', () => {
    expect(() =>
      validatePersonChange(household, [a, k], a, viewer, { action: 'color', value: '#87684d' }),
    ).not.toThrow();
    expect(() =>
      validatePersonChange(household, [a, k], k, viewer, { action: 'color', value: '#87684d' }),
    ).toThrow('own');
    expect(() =>
      validatePersonChange(household, [a, k], a, viewer, { action: 'color', value: '#976783' }),
    ).toThrow('already uses');
    expect(() =>
      validatePersonChange(household, [a, k], a, viewer, { action: 'color', value: '#ffffff' }),
    ).toThrow('available');
  });
  it('denies outsiders and deleting login records', () => {
    expect(() =>
      validatePersonChange(
        household,
        [a, k],
        a,
        { ...viewer, uid: 'outsider' },
        { action: 'color', value: '#87684d' },
      ),
    ).toThrow('member');
    expect(() =>
      validatePersonChange(household, [a, k], { ...k, status: 'archived' }, viewer, {
        action: 'delete',
      }),
    ).toThrow('Archive');
  });
});
