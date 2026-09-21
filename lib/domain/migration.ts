import { generateKeyBetween } from 'fractional-indexing';
import { captureItem } from './items';
import type { Item, LogEntry, Viewer } from '@/lib/types';

export interface LegacyTask {
  id: string;
  title: string;
  detail: string;
  category: string;
  assignee: string;
  done: boolean;
}
export interface MigrationChoice {
  category?: Item['category'];
  dianaActionable?: boolean;
}
export function migrateTask(
  task: LegacyTask,
  list: 'personal-projects' | 'home-projects',
  viewer: Viewer,
  now: string,
  previousKey: string | null,
  choice: MigrationChoice = {},
): { item: Item; log: LogEntry[]; review: string[] } {
  const item = captureItem(
    task.title,
    viewer,
    now,
    `legacy-${list}-${task.id}`,
    generateKeyBetween(previousKey, null),
  );
  const review: string[] = [];
  item.scope = list === 'home-projects' ? 'household' : 'private';
  item.ownerPersonIds = list === 'home-projects' ? ['andrew', 'karen'] : ['andrew'];
  if (task.assignee === 'karen') item.ownerPersonIds = ['karen'];
  if (task.assignee === 'everyone' || !task.assignee)
    item.ownerPersonIds = item.scope === 'household' ? [] : ['andrew'];
  item.status = task.done ? 'done' : 'active';
  item.category = choice.category ?? (task.category === 'home' ? 'home' : 'personal');
  if (['shopping', 'errands'].includes(task.category) && !choice.category)
    review.push('Choose home or personal for this shopping/errands item.');
  if (task.assignee === 'diana') {
    item.historicalOwnerNames = ['Diana'];
    if (task.done) item.ownerPersonIds = ['diana'];
    else if (choice.dianaActionable === undefined) {
      review.push('Review Diana’s item: still actionable or archive.');
      item.status = 'cancelled';
      item.ownerPersonIds = ['diana'];
    } else if (choice.dianaActionable) {
      item.ownerPersonIds = [];
      item.scope = 'household';
    } else {
      item.status = 'cancelled';
      item.ownerPersonIds = ['diana'];
    }
    if (item.ownerPersonIds.includes('diana')) item.scope = 'household';
  } else if (task.assignee && !['andrew', 'karen', 'everyone'].includes(task.assignee)) {
    item.historicalOwnerNames = [task.assignee];
    review.push(`Unknown historical owner: ${task.assignee}`);
  }
  // Do not invent intent, creation time or completion time from a six-field source.
  const log: LogEntry[] = [
    { id: 'capture', at: now, by: viewer.uid, kind: 'capture', text: task.title },
  ];
  if (task.detail.trim())
    log.push({
      id: 'detail',
      at: new Date(Date.parse(now) + 1).toISOString(),
      by: viewer.uid,
      kind: 'note',
      text: task.detail,
    });
  log.push({
    id: 'migration',
    at: new Date(Date.parse(now) + 2).toISOString(),
    by: viewer.uid,
    kind: 'migrated',
    text: `Imported from ${list}/${task.id}. Original category: ${task.category}. Original owner: ${task.assignee || 'unassigned'}. Original dates and intent were not recorded.${task.assignee === 'diana' ? ' Historical owner: Diana.' : ''}`,
  });
  return { item, log, review };
}
