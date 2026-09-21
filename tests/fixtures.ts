import { captureItem } from '@/lib/domain/items';
import type { Item, Viewer } from '@/lib/types';
export const viewer: Viewer = { uid: 'andrew-uid', personId: 'andrew', householdIds: ['blevins'] };
export const now = '2026-09-21T14:00:00Z';
export const context = { now, timeZone: 'America/New_York', context: 'any' as const };
export function item(patch: Partial<Item> = {}): Item {
  return {
    ...captureItem('Caulk shower', viewer, '2026-01-01T15:00:00Z', 'item-1', 'a0'),
    status: 'active',
    ...patch,
  };
}
