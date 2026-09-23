import type { Item } from '@/lib/types';
export function itemHref(item: Pick<Item, 'id' | 'urlId'>) {
  return `/items/${item.urlId ?? item.id}`;
}
