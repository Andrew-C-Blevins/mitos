import { expect, it } from 'vitest';
import { stepPreview, previousAction, completedPrefixLength } from '@/lib/domain/steps';
import { itemHref } from '@/lib/domain/item-links';
import { item } from './fixtures';

it('collapses only the completed prefix, including out-of-order completions as work catches up', () => {
  const steps = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    text: `Step ${index + 1}`,
    done: index < 6 || index === 7,
  }));
  const order = steps.map((step) => step.id);
  expect(completedPrefixLength(steps)).toBe(6);
  steps[6].done = true;
  expect(completedPrefixLength(steps)).toBe(8);
  expect(stepPreview({ steps })).toBe('Step 9');
  steps[1].done = false;
  expect(completedPrefixLength(steps)).toBe(1);
  expect(stepPreview({ steps })).toBe('Step 2');
  expect(steps.map((step) => step.id)).toEqual(order);
});
it('handles empty, all completed and newly extended checklists without a size threshold', () => {
  expect(completedPrefixLength([])).toBe(0);
  const steps = [{ id: 'a', text: 'First', done: true }];
  expect(completedPrefixLength(steps)).toBe(1);
  steps.push({ id: 'b', text: 'Second', done: false });
  expect(completedPrefixLength(steps)).toBe(1);
  steps[0].done = false;
  steps[1].done = true;
  expect(completedPrefixLength(steps)).toBe(0);
});

it('derives the first unfinished step, respects order and never uses stale instructions', () => {
  const task = item({
    nextAction: 'Stale instructions',
    steps: [
      { id: 'a', text: 'Call', done: false },
      { id: 'b', text: 'Gather', done: true },
      { id: 'c', text: 'Submit', done: false },
    ],
  });
  expect(stepPreview(task)).toBe('Call');
  task.steps[0].done = true;
  expect(stepPreview(task)).toBe('Submit');
  task.steps[0].done = false;
  expect(stepPreview(task)).toBe('Call');
  task.steps.forEach((step) => (step.done = true));
  expect(stepPreview(task)).toBe('All steps checked');
  expect(task.status).toBe('active');
  expect(stepPreview(item({ nextAction: 'Old text' }))).toBeUndefined();
});
it('preserves unique former instructions as reference and suppresses duplicate step text', () => {
  expect(previousAction(item({ nextAction: 'Old text' }))).toBe('Old text');
  expect(previousAction(item())).toBeUndefined();
  expect(
    previousAction(item({ nextAction: 'Call.', steps: [{ id: 'a', text: 'call', done: true }] })),
  ).toBeUndefined();
});
it('uses opaque aliases for links without changing the underlying record identity', () => {
  expect(itemHref(item({ urlId: 'a'.repeat(32) }))).toBe(`/items/${'a'.repeat(32)}`);
  expect(itemHref(item())).toBe('/items/item-1');
});
