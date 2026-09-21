import { Temporal } from '@js-temporal/polyfill';
import rrule from 'rrule/dist/es5/rrule.js';
import type { Context, Item, Recurrence } from '@/lib/types';

export interface RuleContext {
  now: string;
  timeZone: string;
  context?: Context | 'any';
}
const { RRule } = rrule;
export type Readiness = { state: 'hidden' | 'ready' | 'blocked' | 'unavailable'; reason: string };
export function localDate(now: string, timeZone: string): string {
  return Temporal.Instant.from(now).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}
export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function inSeason(date: string, season?: Recurrence['season']): boolean {
  if (!season) return true;
  const day = date.slice(5);
  return season.start <= season.end
    ? day >= season.start && day <= season.end
    : day >= season.start || day <= season.end;
}
export function clampToSeason(date: string, season?: Recurrence['season']): string {
  if (!season || inSeason(date, season)) return date;
  const year = Number(date.slice(0, 4)) + (date.slice(5) > season.start ? 1 : 0);
  // A Feb 29 start becomes Feb 28 in a non-leap year (Temporal's constrain behavior).
  return Temporal.PlainDate.from({
    year,
    month: Number(season.start.slice(0, 2)),
    day: Number(season.start.slice(3)),
  }).toString();
}
export function isSnoozed(item: Item, today: string): boolean {
  return Boolean(item.snoozeUntil && item.snoozeUntil > today);
}
export function readiness(item: Item, context: RuleContext): Readiness {
  const today = localDate(context.now, context.timeZone);
  if (item.status !== 'active' || isSnoozed(item, today)) return { state: 'hidden', reason: '' };
  if (item.availableFrom && item.availableFrom > today)
    return { state: 'unavailable', reason: `after ${shortDate(item.availableFrom)}` };
  if (!inSeason(today, item.recurrence?.season))
    return {
      state: 'unavailable',
      reason: `after ${shortDate(clampToSeason(today, item.recurrence?.season))}`,
    };
  const missing = item.needs.filter((need) => !need.satisfied);
  if (missing.length)
    return {
      state: 'blocked',
      reason: missing
        .map((need) => (need.waitingOn ? `waiting on ${need.waitingOn}` : `needs ${need.text}`))
        .join('; '),
    };
  const local = Temporal.Instant.from(context.now).toZonedDateTimeISO(context.timeZone);
  if (item.businessHours && (local.dayOfWeek > 5 || local.hour < 9 || local.hour >= 17)) {
    return {
      state: 'unavailable',
      reason:
        local.dayOfWeek > 5 || (local.dayOfWeek === 5 && local.hour >= 17)
          ? 'after 9 AM Monday'
          : 'after 9 AM',
    };
  }
  if (
    context.context &&
    context.context !== 'any' &&
    item.contexts.length &&
    !item.contexts.includes(context.context)
  ) {
    return { state: 'unavailable', reason: `needs ${item.contexts.join(' or ')}` };
  }
  return { state: 'ready', reason: item.nextAction ?? item.title };
}
export function nextOccurrence(item: Item, completedAt: string, timeZone: string): string {
  if (!item.recurrence) throw new Error('This item does not repeat.');
  const recurrence = item.recurrence;
  const completed = localDate(completedAt, timeZone);
  let next: string;
  if (recurrence.kind === 'afterCompletion') {
    next = addDays(completed, recurrence.intervalDays);
  } else {
    // RRULE works on floating local calendar dates, never elapsed 24-hour intervals.
    const anchor = localDate(item.createdAt, timeZone);
    const rule = new RRule({
      ...RRule.parseString(recurrence.rule),
      dtstart: new Date(`${anchor}T00:00:00Z`),
    });
    const occurrence = rule.after(new Date(`${completed}T23:59:59Z`));
    if (!occurrence)
      throw new Error(
        'This calendar rule has no future occurrence. Edit the recurrence before completing.',
      );
    next = occurrence.toISOString().slice(0, 10);
  }
  return clampToSeason(next, recurrence.season);
}
export function completionPatch(item: Item, completedAt: string, timeZone: string): Partial<Item> {
  if (item.status !== 'active' && item.status !== 'inbox')
    throw new Error('Only open items can be completed.');
  if (!item.recurrence) return { status: 'done', completedAt };
  const next = nextOccurrence(item, completedAt, timeZone);
  return {
    status: 'active',
    recurrence: { ...item.recurrence, lastCompletedAt: completedAt },
    availableFrom: next,
    targetDate: next,
  };
}
export function shortDate(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
}
export function dateMark(item: Item, today: string): { text: string; overdue: boolean } | null {
  if (item.dueDate)
    return {
      text: shortDate(item.dueDate),
      overdue: item.dueDate < today && (item.status === 'active' || item.status === 'inbox'),
    };
  const target = item.targetDate ?? item.availableFrom;
  return target
    ? {
        text: `~${Temporal.PlainDate.from(target).toLocaleString('en-US', { month: 'short' })}`,
        overdue: false,
      }
    : null;
}
export function dueItems(items: Item[], context: RuleContext): Item[] {
  const today = localDate(context.now, context.timeZone);
  return items
    .filter((item) => item.status === 'active' && item.dueDate && !isSnoozed(item, today))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || compareSortKey(a.sortKey, b.sortKey));
}
export function compareSortKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export interface ReadyQuery extends RuleContext {
  minutes?: number;
  focus?: Item['focus'];
}
const effortOrder = { quick: 0, sitting: 1, multi: 2 };
const focusOrder = { low: 0, normal: 1, high: 2 };
export function readyNow(items: Item[], query: ReadyQuery): { item: Item; reason: string }[] {
  const today = localDate(query.now, query.timeZone);
  const soon = addDays(today, 7);
  const effortLimit =
    query.minutes === undefined ? 2 : query.minutes < 20 ? 0 : query.minutes < 90 ? 1 : 2;
  const urgent = (item: Item) => Boolean(item.dueDate && item.dueDate <= soon);
  const focusFits = (item: Item) =>
    !query.focus || focusOrder[item.focus] <= focusOrder[query.focus];
  return items
    .filter(
      (item) => readiness(item, query).state === 'ready' && effortOrder[item.effort] <= effortLimit,
    )
    .sort(
      (a, b) =>
        Number(urgent(b)) - Number(urgent(a)) ||
        Number(focusFits(b)) - Number(focusFits(a)) ||
        effortOrder[a.effort] - effortOrder[b.effort] ||
        (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') ||
        compareSortKey(a.sortKey, b.sortKey),
    )
    .slice(0, 8)
    .map((item) => ({
      item,
      reason: urgent(item)
        ? `Due ${shortDate(item.dueDate!)}`
        : (item.nextAction ??
          (item.effort === 'quick'
            ? 'A quick action with everything in place'
            : 'Everything you need is in place')),
    }));
}
export function isStale(item: Item, lastLogAt: string | undefined, context: RuleContext): boolean {
  const today = localDate(context.now, context.timeZone);
  return (
    item.status === 'active' &&
    !isSnoozed(item, today) &&
    localDate(lastLogAt ?? item.createdAt, context.timeZone) <= addDays(today, -60)
  );
}
