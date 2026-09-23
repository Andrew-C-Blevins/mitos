import type { Item } from '@/lib/types';

export function stepPreview(item: Pick<Item, 'steps'>): string | undefined {
  return (
    item.steps.find((step) => !step.done)?.text ??
    (item.steps.length ? 'All steps checked' : undefined)
  );
}

// Keep former free-form instructions accessible as reference, never resurrect
// them as an unfinished step or use them to choose the current action.
export function previousAction(item: Pick<Item, 'steps' | 'nextAction'>) {
  const normalize = (text: string) =>
    text
      .trim()
      .toLocaleLowerCase()
      .replace(/[.!?]+$/, '');
  return item.nextAction &&
    !item.steps.some((step) => normalize(step.text) === normalize(item.nextAction!))
    ? item.nextAction
    : undefined;
}
