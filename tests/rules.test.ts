import { describe, expect, it } from 'vitest';
import {
  addDays,
  localDate,
  inSeason,
  clampToSeason,
  readiness,
  nextOccurrence,
  completionPatch,
  shortDate,
  dateMark,
  dueItems,
  readyNow,
  isStale,
  compareSortKey,
} from '@/lib/domain/rules';
import { item, context } from './fixtures';

describe('local dates and seasons', () => {
  it('uses viewer-local dates rather than UTC boundaries', () => {
    expect(localDate('2026-09-22T02:00:00Z', 'America/New_York')).toBe('2026-09-21');
    expect(localDate('2026-09-22T02:00:00Z', 'Asia/Tokyo')).toBe('2026-09-22');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('includes season boundaries and clamps ordinary seasons', () => {
    const season = { start: '04-01', end: '10-31' };
    expect(inSeason('2026-04-01', season)).toBe(true);
    expect(inSeason('2026-10-31', season)).toBe(true);
    expect(inSeason('2026-01-03', season)).toBe(false);
    expect(inSeason('2026-01-03')).toBe(true);
    expect(clampToSeason('2026-01-03', season)).toBe('2026-04-01');
    expect(clampToSeason('2026-11-01', season)).toBe('2027-04-01');
    expect(clampToSeason('2026-07-01', season)).toBe('2026-07-01');
    expect(clampToSeason('2026-07-01')).toBe('2026-07-01');
  });
  it('handles seasons crossing New Year and leap days', () => {
    const season = { start: '11-01', end: '02-28' };
    for (const date of ['2026-12-31', '2027-01-01', '2027-02-28', '2026-11-01'])
      expect(inSeason(date, season)).toBe(true);
    expect(inSeason('2026-06-01', season)).toBe(false);
    expect(clampToSeason('2026-06-01', season)).toBe('2026-11-01');
    expect(clampToSeason('2027-01-01', { start: '02-29', end: '05-01' })).toBe('2027-02-28');
  });
});
describe('readiness', () => {
  it('hides inactive and snoozed items', () => {
    for (const status of ['inbox', 'done', 'cancelled'] as const)
      expect(readiness(item({ status }), context).state).toBe('hidden');
    expect(readiness(item({ snoozeUntil: '2026-09-22' }), context).state).toBe('hidden');
    expect(readiness(item({ snoozeUntil: '2026-09-21' }), context).state).toBe('ready');
  });
  it('availability is checked before needs; a season applies before first completion', () => {
    const needs = [{ id: 'caulk', text: 'caulk', kind: 'material' as const, satisfied: false }];
    expect(readiness(item({ availableFrom: '2026-10-01', needs }), context)).toEqual({
      state: 'unavailable',
      reason: 'after Oct 1',
    });
    expect(readiness(item({ needs }), context)).toEqual({
      state: 'blocked',
      reason: 'needs caulk',
    });
    expect(readiness(item({ needs: [{ ...needs[0], satisfied: true }] }), context).state).toBe(
      'ready',
    );
    expect(readiness(item({ needs: [{ ...needs[0], waitingOn: 'Bob' }] }), context).reason).toBe(
      'waiting on Bob',
    );
    expect(
      readiness(
        item({
          recurrence: {
            kind: 'afterCompletion',
            intervalDays: 7,
            season: { start: '04-01', end: '10-31' },
          },
        }),
        { ...context, now: '2026-01-03T15:00:00Z' },
      ).state,
    ).toBe('unavailable');
  });
  it('uses weekday 9–5 local time, including DST offsets and boundaries', () => {
    const call = item({ businessHours: true });
    expect(readiness(call, { ...context, now: '2026-09-22T01:00:00Z' }).reason).toBe('after 9 AM');
    expect(readiness(call, { ...context, now: '2026-09-21T12:59:59Z' }).state).toBe('unavailable');
    expect(readiness(call, { ...context, now: '2026-09-21T13:00:00Z' }).state).toBe('ready');
    expect(readiness(call, { ...context, now: '2026-09-21T21:00:00Z' }).state).toBe('unavailable');
    expect(readiness(call, { ...context, now: '2026-09-25T22:00:00Z' }).reason).toBe(
      'after 9 AM Monday',
    );
    expect(readiness(call, { ...context, now: '2026-09-26T15:00:00Z' }).reason).toBe(
      'after 9 AM Monday',
    );
    expect(readiness(call, { ...context, now: '2026-03-09T13:00:00Z' }).state).toBe('ready');
    expect(readiness(call, { ...context, now: '2026-11-02T13:59:00Z' }).state).toBe('unavailable');
    expect(readiness(call, { ...context, now: '2026-11-02T14:00:00Z' }).state).toBe('ready');
  });
  it('matches context or anywhere and uses optional next action', () => {
    expect(readiness(item({ contexts: ['computer'] }), { ...context, context: 'home' })).toEqual({
      state: 'unavailable',
      reason: 'needs computer',
    });
    expect(
      readiness(item({ contexts: ['computer'] }), { ...context, context: undefined }).state,
    ).toBe('ready');
    expect(
      readiness(item({ contexts: ['computer'] }), { ...context, context: 'computer' }).state,
    ).toBe('ready');
    expect(readiness(item(), { ...context, context: 'home' }).state).toBe('ready');
    expect(readiness(item({ nextAction: 'Buy silicone' }), context).reason).toBe('Buy silicone');
  });
});
describe('recurrence', () => {
  it('keeps the document active and advances both dates without changing the due date', () => {
    const routine = item({
      recurrence: { kind: 'afterCompletion', intervalDays: 7 },
      dueDate: '2026-12-01',
    });
    const patch = completionPatch(routine, context.now, context.timeZone);
    expect(patch).toMatchObject({
      status: 'active',
      availableFrom: '2026-09-28',
      targetDate: '2026-09-28',
      recurrence: { lastCompletedAt: context.now },
    });
    expect(patch).not.toHaveProperty('dueDate');
    for (let days = 0; days < 7; days++)
      expect(
        readiness(
          { ...routine, ...patch },
          { ...context, now: `${addDays('2026-09-21', days)}T14:00:00Z` },
        ).state,
      ).toBe('unavailable');
    expect(
      readiness({ ...routine, ...patch }, { ...context, now: '2026-09-28T14:00:00Z' }).state,
    ).toBe('ready');
  });
  it('adds local calendar days across spring and fall DST', () => {
    const routine = item({ recurrence: { kind: 'afterCompletion', intervalDays: 1 } });
    expect(nextOccurrence(routine, '2026-03-08T04:30:00Z', context.timeZone)).toBe('2026-03-08');
    expect(nextOccurrence(routine, '2026-11-01T03:30:00Z', context.timeZone)).toBe('2026-11-01');
  });
  it('advances calendar rules from the creation anchor, then clamps the season', () => {
    const routine = item({
      recurrence: {
        kind: 'calendar',
        rule: 'FREQ=WEEKLY;BYDAY=SA',
        season: { start: '04-01', end: '10-31' },
      },
    });
    expect(nextOccurrence(routine, context.now, context.timeZone)).toBe('2026-09-26');
    expect(nextOccurrence(routine, '2026-10-31T17:00:00Z', context.timeZone)).toBe('2027-04-01');
    expect(
      nextOccurrence(
        item({ recurrence: { kind: 'calendar', rule: 'FREQ=WEEKLY;BYDAY=SA' } }),
        '2026-03-06T18:00:00Z',
        context.timeZone,
      ),
    ).toBe('2026-03-07');
  });
  it('rejects exhausted rules and completion of closed items', () => {
    expect(() => nextOccurrence(item(), context.now, context.timeZone)).toThrow('does not repeat');
    expect(() =>
      nextOccurrence(
        item({ recurrence: { kind: 'calendar', rule: 'FREQ=DAILY;COUNT=1' } }),
        context.now,
        context.timeZone,
      ),
    ).toThrow('no future');
    expect(() => completionPatch(item({ status: 'done' }), context.now, context.timeZone)).toThrow(
      'Only open',
    );
    expect(completionPatch(item({ status: 'inbox' }), context.now, context.timeZone)).toEqual({
      status: 'done',
      completedAt: context.now,
    });
  });
});
describe('dates and deterministic ranking', () => {
  it('compares fractional keys by code point, not locale collation', () => {
    expect(compareSortKey('a0Z', 'a0a')).toBe(-1);
    expect(compareSortKey('a0a', 'a0Z')).toBe(1);
    expect(compareSortKey('a0', 'a0')).toBe(0);
  });
  it('due wins; target and available dates are never overdue', () => {
    expect(shortDate('2026-10-01')).toBe('Oct 1');
    expect(
      dateMark(item({ dueDate: '2026-09-20', targetDate: '2026-01-01' }), '2026-09-21'),
    ).toEqual({ text: 'Sep 20', overdue: true });
    expect(dateMark(item({ dueDate: '2026-09-21' }), '2026-09-21')?.overdue).toBe(false);
    expect(dateMark(item({ dueDate: '2026-09-20', status: 'done' }), '2026-09-21')?.overdue).toBe(
      false,
    );
    expect(dateMark(item({ targetDate: '2026-01-01' }), '2026-09-21')).toEqual({
      text: '~Jan',
      overdue: false,
    });
    expect(dateMark(item({ availableFrom: '2026-10-01' }), '2026-09-21')?.text).toBe('~Oct');
    expect(dateMark(item(), '2026-09-21')).toBe(null);
  });
  it('Due excludes snoozed, undated and closed items and sorts ties by manual order', () => {
    const source = [
      item({ id: 'b', dueDate: '2026-09-21', sortKey: 'a1' }),
      item({ id: 'a', dueDate: '2026-09-21' }),
      item({ id: 'late', dueDate: '2026-10-01' }),
      item({ id: 'old', dueDate: '2026-09-01' }),
      item({ dueDate: '2026-09-01', snoozeUntil: '2026-09-30' }),
      item(),
      item({ dueDate: '2026-09-01', status: 'done' }),
    ];
    expect(dueItems(source, context).map((item) => item.id)).toEqual(['old', 'a', 'b', 'late']);
  });
  it('ranks urgency then requested focus then effort then target then manual order', () => {
    const source = [
      item({ id: 'multi', effort: 'multi' }),
      item({ id: 'urgent', dueDate: '2026-09-28', focus: 'high', effort: 'multi' }),
      item({ id: 'high', focus: 'high' }),
      item({ id: 'later', targetDate: '2026-10-01' }),
      item({ id: 'early', targetDate: '2026-09-01' }),
      item({ id: 'manual-b', sortKey: 'a2' }),
      item({ id: 'manual-a', sortKey: 'a1' }),
      item({
        id: 'blocked',
        needs: [{ id: 'n', text: 'caulk', kind: 'material', satisfied: false }],
      }),
    ];
    expect(readyNow(source, { ...context, focus: 'normal' }).map((row) => row.item.id)).toEqual([
      'urgent',
      'early',
      'later',
      'manual-a',
      'manual-b',
      'multi',
      'high',
    ]);
    expect(readyNow(source, context)[0].reason).toBe('Due Sep 28');
  });
  it('maps minutes at 20/90 boundaries, returns eight, and supplies reasons without a network call', () => {
    const source = [
      item(),
      item({ id: 'sitting', effort: 'sitting' }),
      item({ id: 'multi', effort: 'multi' }),
    ];
    expect(readyNow(source, { ...context, minutes: 19 })).toHaveLength(1);
    expect(readyNow(source, { ...context, minutes: 20 })).toHaveLength(2);
    expect(readyNow(source, { ...context, minutes: 89 })).toHaveLength(2);
    expect(readyNow(source, { ...context, minutes: 90 })).toHaveLength(3);
    expect(readyNow([item({ nextAction: 'Buy caulk' })], context)[0].reason).toBe('Buy caulk');
    expect(readyNow(source, context).map((row) => row.reason)).toEqual([
      'A quick action with everything in place',
      'Everything you need is in place',
      'Everything you need is in place',
    ]);
    const many = Array.from({ length: 200 }, (_, i) => item({ id: `item-${i}` }));
    const started = performance.now();
    expect(readyNow(many, context)).toHaveLength(8);
    expect(performance.now() - started).toBeLessThan(100);
  });
  it('flags active unsnoozed items after sixty days without a log entry', () => {
    expect(isStale(item(), undefined, context)).toBe(true);
    expect(isStale(item(), '2026-09-20T14:00:00Z', context)).toBe(false);
    expect(isStale(item({ status: 'done' }), undefined, context)).toBe(false);
    expect(isStale(item({ snoozeUntil: '2026-10-01' }), undefined, context)).toBe(false);
  });
});
