// SDK-neutral serialization. Never passes Timestamp instances into domain logic.
const timestampFields = new Set([
  'createdAt',
  'updatedAt',
  'completedAt',
  'archivedAt',
  'decidedAt',
  'lastCompletedAt',
  'resolvedAt',
  'at',
]);
export function decode<T>(id: string, data: Record<string, unknown>): T {
  const visit = (value: unknown): unknown => {
    if (
      value &&
      typeof value === 'object' &&
      'toDate' in value &&
      typeof value.toDate === 'function'
    )
      return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, visit(val)]));
    return value;
  };
  return { ...(visit(data) as object), id } as T;
}
export function encode(data: object, timestamp: (date: Date) => unknown): Record<string, unknown> {
  const visit = (value: unknown, key?: string): unknown => {
    if (typeof value === 'string' && key && timestampFields.has(key))
      return timestamp(new Date(value));
    if (Array.isArray(value)) return value.map((value) => visit(value));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .map(([key, val]) => [key, visit(val, key)]),
      );
    return value;
  };
  const result = visit(data) as Record<string, unknown>;
  delete result.id;
  return result;
}
