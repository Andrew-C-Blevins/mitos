import { z } from 'zod';
import type { Household, Person, Viewer } from '@/lib/types';

export const personColors = [
  { value: '#537a67', label: 'Sage' },
  { value: '#976783', label: 'Plum' },
  { value: '#87684d', label: 'Bronze' },
  { value: '#65778a', label: 'Slate' },
  { value: '#ad754b', label: 'Ochre' },
  { value: '#857e46', label: 'Olive' },
] as const;
export const personChangeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('color'), value: z.string().regex(/^#[0-9a-f]{6}$/i) }).strict(),
  z.object({ action: z.literal('status'), value: z.enum(['active', 'archived']) }).strict(),
  z.object({ action: z.literal('role'), value: z.enum(['admin', 'user']) }).strict(),
  z.object({ action: z.literal('delete') }).strict(),
]);
export type PersonChange = z.infer<typeof personChangeSchema>;

export function validatePersonChange(
  household: Household,
  people: Person[],
  person: Person,
  viewer: Viewer,
  change: PersonChange,
) {
  if (
    !household.memberUids.includes(viewer.uid) ||
    !viewer.householdIds.includes(household.id) ||
    person.householdId !== household.id
  )
    throw new Error('You are not a member of this household.');
  if (change.action === 'color') {
    if (person.uid !== viewer.uid || person.id !== viewer.personId || person.status !== 'active')
      throw new Error('You can change only your own color.');
    if (!personColors.some((color) => color.value === change.value.toLowerCase()))
      throw new Error('Choose one of the available colors.');
    if (
      people.some(
        (other) =>
          other.id !== person.id &&
          other.status === 'active' &&
          other.color.toLowerCase() === change.value.toLowerCase(),
      )
    )
      throw new Error('Someone in your household already uses that color. Choose another.');
    return;
  }
  if (!household.adminUids?.includes(viewer.uid))
    throw new Error('Only a household admin can manage people.');
  const removesAdmin =
    change.action === 'delete' ||
    (change.action === 'status' && change.value === 'archived') ||
    (change.action === 'role' && change.value === 'user');
  if (
    removesAdmin &&
    person.uid &&
    household.adminUids.includes(person.uid) &&
    !people.some(
      (other) =>
        other.id !== person.id &&
        other.status === 'active' &&
        other.uid &&
        household.adminUids?.includes(other.uid) &&
        household.memberUids.includes(other.uid),
    )
  )
    throw new Error('Keep at least one active household admin. Make someone else an admin first.');
  if (change.action === 'role' && (!person.uid || person.status !== 'active'))
    throw new Error('Only active people with a login can have an admin role.');
  if (
    change.action === 'status' &&
    change.value === 'active' &&
    people.some(
      (other) =>
        other.id !== person.id &&
        other.status === 'active' &&
        other.color.toLowerCase() === person.color.toLowerCase(),
    )
  )
    throw new Error(
      'This person’s color is already in use. Change the active person’s color before restoring.',
    );
  if (change.action === 'delete' && (person.uid || person.status !== 'archived'))
    throw new Error(
      'Archive people with a login to remove their access while preserving their history.',
    );
}
