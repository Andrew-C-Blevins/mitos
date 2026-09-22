'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { categories, categoryLabels, type Item, type Person } from '@/lib/types';
import { movedSortKey } from '@/lib/domain/ordering';
import { saveError } from '@/lib/domain/input';
import { subscribeItems, updateFields, complete } from '@/lib/data/client/items';
import { subscribePeople } from '@/lib/data/client/people';
import { isSnoozed, dateMark, localDate, addDays } from '@/lib/domain/rules';
import { useSession } from './auth-provider';
import { DeleteItemDialog } from './delete-item-dialog';
import { SortableList, type ListMove } from './ui/sortable-list';

type Filter = 'mine' | 'household' | 'karen' | 'all';
type Sort = 'manual' | 'due' | 'target';
export function EverythingScreen() {
  const router = useRouter(),
    pathname = usePathname();
  const { viewer } = useSession();
  const [items, setItems] = useState<Item[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [loaded, setLoaded] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all'),
    [category, setCategory] = useState(''),
    [waiting, setWaiting] = useState(false),
    [recurring, setRecurring] = useState(false),
    [sort, setSort] = useState<Sort>('manual'),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [inboxOpen, setInboxOpen] = useState(false),
    [deleting, setDeleting] = useState<Item | null>(null),
    [message, setMessage] = useState('');
  const latestItems = useRef<Item[]>([]);
  const savedPosition = useRef<{ id: string; sortKey: string; version: number } | null>(null);
  useEffect(
    () =>
      subscribeItems(
        viewer,
        (items, pending) => {
          latestItems.current = items;
          const position = savedPosition.current;
          const updated = position && items.find((item) => item.id === position.id);
          if (position && (!updated || updated.version >= position.version))
            savedPosition.current = null;
          setItems(
            savedPosition.current
              ? items.map((item) =>
                  item.id === position?.id ? { ...item, sortKey: position.sortKey } : item,
                )
              : items,
          );
          setPending(pending);
          setLoaded(true);
        },
        (error) => {
          setError(error.message);
          setLoaded(true);
        },
      ),
    [viewer],
  );
  useEffect(
    () => subscribePeople(viewer.householdIds[0], setPeople, (error) => setError(error.message)),
    [viewer.householdIds],
  );
  const today = localDate(
    new Date().toISOString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const inbox = items.filter((item) => item.status === 'inbox');
  const filtered = items.filter(
    (item) =>
      item.status === 'active' &&
      (filter === 'all' ||
        (filter === 'mine' && item.ownerPersonIds.includes(viewer.personId)) ||
        (filter === 'household' && item.scope === 'household') ||
        (filter === 'karen' && item.ownerPersonIds.includes('karen'))) &&
      (!category || item.category === category) &&
      (!waiting || item.needs.some((need) => !need.satisfied && need.waitingOn)) &&
      (!recurring || item.recurrence),
  );
  const sorted = [...filtered].sort(
    (a, b) =>
      (sort === 'manual'
        ? 0
        : (a[sort === 'due' ? 'dueDate' : 'targetDate'] ?? '9999').localeCompare(
            b[sort === 'due' ? 'dueDate' : 'targetDate'] ?? '9999',
          )) || (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0),
  );
  const awake = sorted.filter((item) => !isSnoozed(item, today)),
    snoozed = sorted.filter((item) => isSnoozed(item, today));
  function run(action: () => Promise<unknown>) {
    setError('');
    void action().catch((caught) => setError(saveError(caught)));
  }
  function snooze(item: Item, date = addDays(today, 7)) {
    run(() => updateFields(item, { snoozeUntil: date }, viewer, `Snoozed until ${date}.`));
  }
  function toggle(id: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function reorder(move: ListMove) {
    const current = latestItems.current.find((item) => item.id === move.id);
    if (!current || current.status !== 'active')
      throw new Error('This to-do is no longer available.');
    const sortKey = movedSortKey(latestItems.current, current, move);
    savedPosition.current = { id: current.id, sortKey, version: current.version + 1 };
    setItems((items) =>
      items.map((item) => (item.id === current.id ? { ...item, sortKey } : item)),
    );
    try {
      await updateFields(current, { sortKey }, viewer);
    } catch (caught) {
      savedPosition.current = null;
      setItems(latestItems.current);
      throw new Error(saveError(caught));
    }
  }
  function renderRows(source: Item[], nested = false): ReactNode {
    const roots = source.filter(
      (item) => !item.parentId || !source.some((parent) => parent.id === item.parentId),
    );
    const rows = roots.map((item) => ({
      ...item,
      childRows: source.filter((child) => child.parentId === item.id),
    }));
    return (
      <SortableList
        items={rows}
        getId={(item) => item.id}
        getLabel={(item) => item.title}
        label={nested ? 'Nested to-dos' : 'To-dos'}
        disabled={sort !== 'manual'}
        canDrag={(item) => nested || !item.parentId}
        onReorder={reorder}
        renderOverlay={(item) => (
          <>
            <div className="drag-preview">
              <span className="completion-circle" />
              <div>
                <strong>{item.title}</strong>
                {item.childRows.length ? (
                  <small>
                    With {item.childRows.length} nested to-do
                    {item.childRows.length === 1 ? '' : 's'}
                  </small>
                ) : (
                  <small>{categoryLabels[item.category]}</small>
                )}
              </div>
            </div>
            {!collapsed.has(item.id)
              ? item.childRows.map((child) => (
                  <div className="drag-preview drag-preview-child" key={child.id}>
                    <span className="completion-circle" />
                    <div>
                      <strong>{child.title}</strong>
                    </div>
                  </div>
                ))
              : null}
          </>
        )}
        renderItem={(item, handle) => (
          <>
            <ItemRow
              item={item}
              people={people}
              me={viewer.personId}
              today={today}
              nested={nested}
              hasChildren={item.childRows.length > 0}
              collapsed={collapsed.has(item.id)}
              onToggle={() => toggle(item.id)}
              onComplete={() => run(() => complete(item, viewer))}
              onSnooze={() => snooze(item)}
              dragHandle={handle}
            />
            {item.childRows.length && !collapsed.has(item.id)
              ? renderRows(item.childRows, true)
              : null}
          </>
        )}
      />
    );
  }
  return (
    <section className="everything" aria-label="Everything">
      <div className="list-heading">
        <h1>Everything</h1>
        <span className="mono count">{filtered.length}</span>
      </div>
      <div className="filters" aria-label="Filter items">
        <div className="filter-line">
          {(['mine', 'household', 'karen', 'all'] as const)
            .filter(
              (value) =>
                value !== 'karen' ||
                people.some((person) => person.id === 'karen' && person.status === 'active'),
            )
            .map((value) => (
              <button
                key={value}
                className={filter === value ? 'active-filter' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
        </div>
        <div className="filter-line secondary-filters">
          <label>
            <span className="sr-only">Category</span>
            <select
              aria-label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Category</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <button
            className={waiting ? 'active-filter' : ''}
            aria-pressed={waiting}
            onClick={() => setWaiting((value) => !value)}
          >
            Waiting
          </button>
          <button
            className={recurring ? 'active-filter' : ''}
            aria-pressed={recurring}
            onClick={() => setRecurring((value) => !value)}
          >
            Recurring
          </button>
        </div>
      </div>
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="save-feedback" role="status">
          {message}
        </p>
      ) : null}
      {pending ? (
        <p className="sync-note" role="status">
          Changes waiting to sync.
        </p>
      ) : null}
      {inbox.length ? (
        <section className="inbox-section">
          <button
            className="inbox-heading"
            aria-expanded={inboxOpen}
            onClick={() => setInboxOpen((value) => !value)}
          >
            <Inbox size={16} />
            <span>Inbox</span>
            <span className="mono">{inbox.length}</span>
            {inboxOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {inboxOpen
            ? inbox.map((item) => (
                <div className="inbox-row" key={item.id}>
                  <Link href={`/items/${item.id}`}>{item.title}</Link>
                  <div>
                    <button
                      onClick={() =>
                        run(() =>
                          updateFields(item, { status: 'active' }, viewer, 'Kept from Inbox.'),
                        )
                      }
                    >
                      Keep
                    </button>
                    <Link href={`/items/${item.id}`}>Edit</Link>
                    <button onClick={() => setDeleting(item)}>Delete</button>
                  </div>
                </div>
              ))
            : null}
        </section>
      ) : null}
      <div className="list-toolbar">
        <span className="reorder-hint">
          {sort === 'manual' ? 'Drag a handle to reorder' : 'Choose manual to reorder'}
        </span>
        <button
          onClick={() =>
            setSort((value) => (value === 'manual' ? 'due' : value === 'due' ? 'target' : 'manual'))
          }
        >
          Sort: {sort === 'manual' ? 'manual' : sort === 'due' ? 'due date' : 'target date'}
          <ChevronDown size={13} />
        </button>
      </div>
      {!loaded ? (
        <p className="empty-state" role="status">
          Loading your items…
        </p>
      ) : awake.length ? (
        <div className="item-list">{renderRows(awake)}</div>
      ) : (
        <p className="empty-state">
          {filtered.length
            ? 'These items are snoozed.'
            : filter === 'all' && !category && !waiting && !recurring
              ? 'Capture something you want to come back to.'
              : 'No items match these filters.'}
        </p>
      )}
      {snoozed.length ? (
        <details className="snoozed-section">
          <summary>
            <span>Snoozed</span>
            <span className="mono">{snoozed.length}</span>
            <ChevronDown size={16} />
          </summary>
          <div className="item-list">{renderRows(snoozed)}</div>
        </details>
      ) : null}
      {deleting ? (
        <DeleteItemDialog
          item={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setItems((current) => current.filter((item) => item.id !== deleting.id));
            setDeleting(null);
            setMessage('To-do permanently deleted.');
            if (pathname === `/items/${deleting.id}`) router.replace('/');
          }}
        />
      ) : null}
    </section>
  );
}

interface RowProps {
  item: Item;
  people: Person[];
  me: string;
  today: string;
  nested: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  dragHandle: ReactNode;
}
function ItemRow(props: RowProps) {
  const { item, people, me, today } = props;
  const selected = usePathname() === `/items/${item.id}`;
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const mark = dateMark(item, today),
    blocker = item.needs
      .filter((need) => !need.satisfied)
      .map((need) => (need.waitingOn ? `Waiting on ${need.waitingOn}` : `Needs ${need.text}`))
      .join(', ');
  const owners = item.ownerPersonIds
    .filter((id) => id !== me)
    .map((id) => people.find((person) => person.id === id))
    .filter(Boolean) as Person[];
  const secondary = [item.nextAction, blocker, owners.map((person) => person.name).join(', ')]
    .filter(Boolean)
    .join(' · ');
  return (
    <div
      className={`row-container ${props.nested ? 'nested' : ''}`}
      data-item-id={item.id}
      data-selected={selected || undefined}
    >
      <div className="swipe-action" data-side={offset > 0 ? 'left' : 'right'} aria-hidden="true">
        {offset > 0 ? (
          <span>
            <Check size={16} />
            Complete
          </span>
        ) : (
          <span>Snooze 1 week</span>
        )}
      </div>
      <div
        className="ledger-row"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button, input, .row-marks')) return;
          gesture.current = { x: event.clientX, y: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current) return;
          const dx = event.clientX - current.x,
            dy = event.clientY - current.y;
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            current.moved = true;
          }
          if (Math.abs(dx) > Math.abs(dy) * 1.3) setOffset(Math.max(-120, Math.min(120, dx)));
        }}
        onPointerUp={() => {
          if (offset > 80) props.onComplete();
          else if (offset < -80) props.onSnooze();
          setOffset(0);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setOffset(0);
        }}
        onClickCapture={(event) => {
          if (gesture.current?.moved) {
            event.preventDefault();
            event.stopPropagation();
          }
          gesture.current = null;
        }}
      >
        {props.hasChildren ? (
          <button
            className="row-check"
            aria-label={props.collapsed ? 'Expand children' : 'Collapse children'}
            aria-expanded={!props.collapsed}
            onClick={props.onToggle}
          >
            {props.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : (
          <button
            className="row-check"
            aria-label={`Complete ${item.title}`}
            onClick={props.onComplete}
          >
            <span className="completion-circle" />
          </button>
        )}
        <Link
          href={`/items/${item.id}`}
          draggable={false}
          className="row-copy"
          aria-current={selected ? 'page' : undefined}
        >
          <span className="row-title">{item.title}</span>
          {secondary || mark ? (
            <span className="row-secondary">
              {secondary ? <span>{secondary}</span> : null}
              {mark ? (
                <span className={`mono date-mark ${mark.overdue ? 'overdue' : ''}`}>
                  {mark.text}
                </span>
              ) : null}
            </span>
          ) : null}
        </Link>
        <div className="row-marks">
          <span className="category-mark" aria-label={`Category: ${categoryLabels[item.category]}`}>
            {categoryLabels[item.category]}
          </span>
          {owners.slice(0, 2).map((person) => (
            <span
              key={person.id}
              className="owner-dot"
              style={{ background: person.color }}
              title={person.name}
            />
          ))}
        </div>
        {props.dragHandle}
      </div>
    </div>
  );
}
