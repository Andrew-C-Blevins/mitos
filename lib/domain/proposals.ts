import { itemSchema, type Item, type Change } from '@/lib/types';
import { completionPatch, type RuleContext } from './rules';

const scalarPaths = new Set([
  'title',
  'intent',
  'outcome',
  'nextAction',
  'scope',
  'ownerPersonIds',
  'category',
  'effort',
  'focus',
  'contexts',
  'businessHours',
  'dueDate',
  'targetDate',
  'snoozeUntil',
  'availableFrom',
  'recurrence',
]);
const sectionPaths = new Set(['needs', 'questions', 'decisions', 'steps', 'links']);
export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a).sort(),
    bk = Object.keys(b).sort();
  return (
    ak.length === bk.length &&
    ak.every(
      (key, index) =>
        key === bk[index] &&
        equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}
export function currentValue(item: Item, path: string): unknown {
  const [field, id, property] = path.split('.');
  if (scalarPaths.has(path)) return item[path as keyof Item];
  if (!sectionPaths.has(field)) throw new Error('Unsupported proposal path');
  const rows = item[field as 'needs'];
  const row = rows.find((row) => row.id === id);
  return property ? (row as unknown as Record<string, unknown> | undefined)?.[property] : row;
}
export function allowedTransition(status: Item['status'], next: unknown): boolean {
  return next === 'done' || next === 'cancelled'
    ? status === 'active' || status === 'inbox'
    : next === 'active' && (status === 'inbox' || status === 'done' || status === 'cancelled');
}
export function applyProposal(
  item: Item,
  changes: Change[],
  context: RuleContext,
): { item: Item; appliedIds: string[]; staleIds: string[] } {
  let next = structuredClone(item);
  const appliedIds: string[] = [],
    staleIds: string[] = [];
  for (const change of changes.filter((row) => row.checked)) {
    if (change.class === 'transition') {
      if (change.op !== 'transition' || change.path !== 'status')
        throw new Error('Invalid transition change');
      if (!allowedTransition(next.status, change.value)) {
        staleIds.push(change.id);
        continue;
      }
      next = {
        ...next,
        ...(change.value === 'done'
          ? completionPatch(next, context.now, context.timeZone)
          : { status: change.value as Item['status'] }),
      };
      if (change.value === 'active') delete next.completedAt;
    } else if (change.class === 'commutative') {
      if (change.op !== 'add' || !sectionPaths.has(change.path))
        throw new Error('Only stable-id section additions are supported at this checkpoint');
      const row = change.value as { id?: string };
      if (!row || typeof row.id !== 'string')
        throw new Error('A commutative change needs a stable id');
      const rows = next[change.path as 'needs'];
      if (!rows.some((existing) => existing.id === row.id))
        (next as unknown as Record<string, unknown>)[change.path] = [...rows, row];
    } else {
      if (!equal(currentValue(next, change.path), change.previousValue)) {
        staleIds.push(change.id);
        continue;
      }
      const [field, id, property] = change.path.split('.');
      if (scalarPaths.has(change.path) && change.op === 'set') {
        if (change.value == null) delete (next as unknown as Record<string, unknown>)[field];
        else (next as unknown as Record<string, unknown>)[field] = change.value;
      } else if (sectionPaths.has(field) && id && (change.op === 'set' || change.op === 'remove')) {
        const rows = next[field as 'needs'];
        (next as unknown as Record<string, unknown>)[field] =
          change.op === 'remove'
            ? rows.filter((row) => row.id !== id)
            : rows.map((row) =>
                row.id !== id
                  ? row
                  : property
                    ? { ...row, [property]: change.value }
                    : change.value,
              );
      } else throw new Error('Unsupported conditional change');
    }
    next = itemSchema.parse(next);
    appliedIds.push(change.id);
  }
  if (appliedIds.length) next = { ...next, version: item.version + 1, updatedAt: context.now };
  return { item: next, appliedIds, staleIds };
}
