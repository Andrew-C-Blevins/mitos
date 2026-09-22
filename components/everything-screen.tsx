'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, MoreHorizontal, Inbox, X } from 'lucide-react';
import { categories, categoryLabels, type Item, type Person } from '@/lib/types';
import { movedSortKey } from '@/lib/domain/ordering';
import { saveError } from '@/lib/domain/input';
import { subscribeItems, updateFields, complete } from '@/lib/data/client/items';
import { subscribePeople } from '@/lib/data/client/people';
import { isSnoozed, dateMark, localDate, addDays } from '@/lib/domain/rules';
import { useSession } from './auth-provider';

type Filter = 'mine' | 'household' | 'karen' | 'all';
type Sort = 'manual' | 'due' | 'target';
export function EverythingScreen() {
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
    [quick, setQuick] = useState<Item | null>(null),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [inboxOpen, setInboxOpen] = useState(false);
  useEffect(
    () =>
      subscribeItems(
        viewer,
        (items, pending) => {
          setItems(items);
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
  function renderRows(source: Item[], nested = false): React.ReactNode {
    const roots = source.filter(
      (item) => !item.parentId || !source.some((parent) => parent.id === item.parentId),
    );
    return roots.map((item) => {
      const children = source.filter((child) => child.parentId === item.id),
        hasChildren = children.length > 0;
      return (
        <div key={item.id}>
          <ItemRow
            item={item}
            people={people}
            me={viewer.personId}
            today={today}
            nested={nested}
            hasChildren={hasChildren}
            collapsed={collapsed.has(item.id)}
            onToggle={() => toggle(item.id)}
            onComplete={() => run(() => complete(item, viewer))}
            onSnooze={() => snooze(item)}
            onQuick={() => setQuick(item)}
          />
          {hasChildren && !collapsed.has(item.id)
            ? children.map((child) => (
                <ItemRow
                  key={child.id}
                  item={child}
                  people={people}
                  me={viewer.personId}
                  today={today}
                  nested
                  hasChildren={false}
                  collapsed={false}
                  onToggle={() => {}}
                  onComplete={() => run(() => complete(child, viewer))}
                  onSnooze={() => snooze(child)}
                  onQuick={() => setQuick(child)}
                />
              ))
            : null}
        </div>
      );
    });
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
                    <button
                      onClick={() =>
                        run(() =>
                          updateFields(
                            item,
                            { status: 'cancelled' },
                            viewer,
                            'Deleted from Inbox; original capture preserved.',
                          ),
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            : null}
        </section>
      ) : null}
      <div className="list-toolbar">
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
      {quick ? (
        <QuickMenu
          key={quick.id}
          item={items.find((item) => item.id === quick.id) ?? quick}
          people={people}
          onClose={() => setQuick(null)}
          onSnooze={(date) => snooze(quick, date)}
          siblings={items
            .filter(
              (item) =>
                item.id !== quick.id &&
                item.status === 'active' &&
                item.parentId === quick.parentId,
            )
            .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))}
          onMove={async (destination) => {
            const current = items.find((item) => item.id === quick.id) ?? quick;
            await updateFields(
              current,
              { sortKey: movedSortKey(items, current, destination) },
              viewer,
            );
            setSort('manual');
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
  onQuick: () => void;
}
function ItemRow(props: RowProps) {
  const { item, people, me, today } = props;
  const selected = usePathname() === `/items/${item.id}`;
  const [offset, setOffset] = useState(0);
  const gesture = useRef<{
    x: number;
    y: number;
    timer?: ReturnType<typeof setTimeout>;
    moved: boolean;
    menu: boolean;
  } | null>(null);
  useEffect(
    () => () => {
      if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    },
    [],
  );
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
          gesture.current = { x: event.clientX, y: event.clientY, moved: false, menu: false };
          gesture.current.timer = setTimeout(() => {
            if (gesture.current && !gesture.current.moved) {
              gesture.current.menu = true;
              props.onQuick();
            }
          }, 550);
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current) return;
          const dx = event.clientX - current.x,
            dy = event.clientY - current.y;
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
            current.moved = true;
            clearTimeout(current.timer);
          }
          if (Math.abs(dx) > Math.abs(dy) * 1.3) setOffset(Math.max(-120, Math.min(120, dx)));
        }}
        onPointerUp={() => {
          if (gesture.current?.timer) clearTimeout(gesture.current.timer);
          if (offset > 80) props.onComplete();
          else if (offset < -80) props.onSnooze();
          setOffset(0);
        }}
        onPointerCancel={() => {
          if (gesture.current?.timer) clearTimeout(gesture.current.timer);
          gesture.current = null;
          setOffset(0);
        }}
        onClickCapture={(event) => {
          if (gesture.current?.moved || gesture.current?.menu) {
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
        <button
          className="row-menu"
          aria-label={`Actions for ${item.title}`}
          onClick={props.onQuick}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
function QuickMenu({
  item,
  people,
  onClose,
  onSnooze,
  onMove,
  siblings,
}: {
  item: Item;
  people: Person[];
  onClose: () => void;
  onSnooze: (date?: string) => void;
  onMove: (destination: string) => Promise<void>;
  siblings: Item[];
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [error, setError] = useState(''),
    [moving, setMoving] = useState(false),
    [destination, setDestination] = useState(''),
    [message, setMessage] = useState('');
  const { viewer } = useSession();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(fields: Parameters<typeof updateFields>[1]) {
    setError('');
    setMessage('');
    try {
      await updateFields(item, fields, viewer);
      setMessage('Saved.');
    } catch (error) {
      setError(saveError(error));
    }
  }
  return (
    <dialog
      className="capture-sheet quick-menu"
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="quick-heading"
    >
      <div className="sheet-heading">
        <h2 id="quick-heading">{item.title}</h2>
        <button onClick={onClose} aria-label="Close actions">
          <X size={16} />
        </button>
      </div>
      <button onClick={() => save({ scope: 'household' })}>Move to household</button>
      <fieldset>
        <legend>Assign</legend>
        {people
          .filter((person) => person.status === 'active')
          .map((person) => (
            <label className="check-row" key={person.id}>
              <input
                type="checkbox"
                checked={item.ownerPersonIds.includes(person.id)}
                onChange={() =>
                  save({
                    ownerPersonIds: item.ownerPersonIds.includes(person.id)
                      ? item.ownerPersonIds.filter((id) => id !== person.id)
                      : [...item.ownerPersonIds, person.id],
                  })
                }
              />
              {person.name}
            </label>
          ))}
      </fieldset>
      <button
        onClick={() => {
          onSnooze();
          onClose();
        }}
      >
        Snooze one week
      </button>
      {item.snoozeUntil ? (
        <button onClick={() => save({ snoozeUntil: null })}>Unsnooze</button>
      ) : null}
      <label>
        Snooze until
        <input
          type="date"
          value={item.snoozeUntil ?? ''}
          onChange={(event) => save({ snoozeUntil: event.target.value || null })}
        />
      </label>
      <label>
        Due
        <input
          type="date"
          value={item.dueDate ?? ''}
          onChange={(event) => save({ dueDate: event.target.value || null })}
        />
      </label>
      <label>
        Target
        <input
          type="date"
          value={item.targetDate ?? ''}
          onChange={(event) => save({ targetDate: event.target.value || null })}
        />
      </label>
      <form
        className="move-controls"
        onSubmit={async (event) => {
          event.preventDefault();
          setMoving(true);
          setError('');
          setMessage('');
          try {
            await onMove(destination);
            setMessage('Moved. The list is now in manual order.');
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not move item.');
          } finally {
            setMoving(false);
          }
        }}
      >
        <label>
          Move in list
          <select
            aria-label="Move position"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            required
          >
            <option value="">Choose a position…</option>
            {siblings.map((sibling, index) => (
              <option key={sibling.id} value={sibling.id}>
                {index === 0 ? 'Top — before ' : 'Before '}
                {sibling.title}
              </option>
            ))}
            <option value="end">Bottom</option>
          </select>
        </label>
        <button disabled={moving || !destination}>{moving ? 'Moving…' : 'Move'}</button>
      </form>
      {message ? (
        <p className="save-feedback" role="status">
          {message}
        </p>
      ) : null}
      <button onClick={onClose}>Done</button>
      {error ? <p role="alert">{error}</p> : null}
    </dialog>
  );
}
