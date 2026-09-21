'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ArrowUpRight, WandSparkles, ChevronDown } from 'lucide-react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  categories,
  categoryLabels,
  contexts,
  effortLabels,
  type Item,
  type Person,
  type LogEntry,
  type Section,
} from '@/lib/types';
import {
  subscribeItem,
  subscribeLog,
  olderLog,
  updateFields,
  complete,
  addEntry,
  editEntry,
  answerQuestion,
  addNote,
} from '@/lib/data/client/items';
import { subscribePeople } from '@/lib/data/client/people';
import { useSession } from './auth-provider';
import { InlineText } from './inline-text';
import { shortDate, dateMark, localDate } from '@/lib/domain/rules';
import { newId } from '@/lib/domain/ids';

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="document-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
type OptionalSection = 'intent' | 'nextAction' | 'dates' | Section;
export function ItemScreen({ id }: { id: string }) {
  const { viewer, profile } = useSession();
  const logInitialized = useRef(false);
  const [item, setItem] = useState<Item | null>(null),
    [loaded, setLoaded] = useState(false),
    [people, setPeople] = useState<Person[]>([]),
    [log, setLog] = useState<LogEntry[]>([]),
    [older, setOlder] = useState<LogEntry[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [hasOlder, setHasOlder] = useState(false),
    [error, setError] = useState(''),
    [revealed, setRevealed] = useState<OptionalSection | ''>('');
  useEffect(
    () =>
      subscribeItem(
        id,
        (value) => {
          setItem(value);
          setLoaded(true);
        },
        (error) => {
          setError(error.message);
          setLoaded(true);
        },
      ),
    [id],
  );
  useEffect(
    () => subscribePeople(viewer.householdIds[0], setPeople, (error) => setError(error.message)),
    [viewer.householdIds],
  );
  useEffect(
    () =>
      subscribeLog(
        id,
        (rows, last) => {
          // Keep entries already shown when a new note pushes them past the live window.
          setLog((previous) =>
            [...new Map([...rows, ...previous].map((entry) => [entry.id, entry])).values()].sort(
              (a, b) => b.at.localeCompare(a.at),
            ),
          );
          if (!logInitialized.current) {
            setCursor(last);
            setHasOlder(rows.length === 20);
            logInitialized.current = true;
          }
        },
        (error) => setError(error.message),
      ),
    [id],
  );
  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    }
  }
  if (!loaded)
    return (
      <main className="document">
        <p role="status">Opening item…</p>
      </main>
    );
  if (!item)
    return (
      <main className="document">
        <Link href="/">Back to Everything</Link>
        <p role="alert">{error || 'This item is not available to your account.'}</p>
      </main>
    );
  const activePeople = people.filter((person) => person.status === 'active');
  const today = localDate(
      new Date().toISOString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    mark = dateMark(item, today);
  const field = (key: 'title' | 'intent' | 'nextAction' | 'outcome', text: string) =>
    updateFields(item, { [key]: text || null }, viewer);
  const show = (section: OptionalSection) =>
    revealed === section ||
    (section === 'dates'
      ? Boolean(item.dueDate || item.targetDate || item.availableFrom || item.snoozeUntil)
      : Array.isArray(item[section])
        ? item[section].length > 0
        : Boolean(item[section]));
  const add = async (section: Section, text: string) => {
    if (!text) return;
    const base = { id: newId(), text };
    if (section === 'needs')
      await addEntry(item, section, { ...base, kind: 'material', satisfied: false });
    if (section === 'questions')
      await addEntry(item, section, { ...base, createdAt: new Date().toISOString() });
    if (section === 'decisions')
      await addEntry(item, section, { ...base, decidedAt: new Date().toISOString() });
    if (section === 'steps') await addEntry(item, section, { ...base, done: false });
    setRevealed('');
  };
  return (
    <main className="document">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} /> Everything
      </Link>
      <div className="item-actions">
        <button disabled title="AI is deferred until M3">
          <WandSparkles size={16} />
          Shape
        </button>
        <button disabled title="Handoff is deferred until M4">
          <ArrowUpRight size={16} />
          Work on this
        </button>
        <button
          onClick={() =>
            run(() =>
              item.status === 'done' || item.status === 'cancelled'
                ? updateFields(
                    item,
                    { status: 'active', completedAt: null },
                    viewer,
                    'Reactivated.',
                  )
                : complete(item, viewer),
            )
          }
        >
          <Check size={16} />
          {item.status === 'done' || item.status === 'cancelled' ? 'Reactivate' : 'Complete'}
        </button>
      </div>
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}
      {item.status === 'inbox' ? (
        <div className="inbox-prompt">
          <span>In your Inbox</span>
          <button
            onClick={() =>
              run(() => updateFields(item, { status: 'active' }, viewer, 'Kept from Inbox.'))
            }
          >
            Keep in Everything
          </button>
        </div>
      ) : null}
      {item.status === 'done' || item.status === 'cancelled' ? (
        <p className="mono muted">{item.status === 'done' ? 'Completed' : 'Cancelled'}</p>
      ) : null}
      <h1 className="item-title">
        <InlineText
          value={item.title}
          placeholder="Title"
          label="Edit title"
          onSave={(text) => field('title', text)}
        />
      </h1>
      {show('intent') ? (
        <DocumentSection title="Why">
          <InlineText
            value={item.intent}
            placeholder="Why is this here?"
            multiline
            onSave={(text) => field('intent', text)}
          />
        </DocumentSection>
      ) : null}
      {show('nextAction') ? (
        <DocumentSection title="Next action">
          <InlineText
            value={item.nextAction}
            placeholder="What moves this forward?"
            onSave={(text) => field('nextAction', text)}
          />
        </DocumentSection>
      ) : null}
      {show('dates') ? (
        <DocumentSection title="Dates">
          <div className="date-fields">
            {(['dueDate', 'targetDate', 'availableFrom', 'snoozeUntil'] as const).map((key) => (
              <label key={key}>
                <span>
                  {
                    {
                      dueDate: 'Due',
                      targetDate: 'Target',
                      availableFrom: 'Available from',
                      snoozeUntil: 'Snoozed until',
                    }[key]
                  }
                </span>
                <input
                  className={key === 'dueDate' && mark?.overdue ? 'overdue' : ''}
                  type="date"
                  value={item[key] ?? ''}
                  onChange={(event) =>
                    run(() => updateFields(item, { [key]: event.target.value || null }, viewer))
                  }
                />
              </label>
            ))}
          </div>
        </DocumentSection>
      ) : null}
      {show('needs') ? (
        <DocumentSection title="Needs">
          <ul className="document-list">
            {item.needs.map((need) => (
              <li key={need.id}>
                <div className="check-row">
                  <input
                    type="checkbox"
                    aria-label={`Satisfy ${need.text}`}
                    checked={need.satisfied}
                    onChange={() =>
                      run(() =>
                        editEntry(item.id, 'needs', need, { ...need, satisfied: !need.satisfied }),
                      )
                    }
                  />
                  <InlineText
                    value={need.text}
                    placeholder="Edit need"
                    onSave={(text) => editEntry(item.id, 'needs', need, { ...need, text })}
                  />
                </div>
                <div className="need-meta">
                  <select
                    aria-label={`Kind of ${need.text}`}
                    value={need.kind}
                    onChange={(event) =>
                      run(() =>
                        editEntry(item.id, 'needs', need, {
                          ...need,
                          kind: event.target.value as typeof need.kind,
                        }),
                      )
                    }
                  >
                    {['material', 'person', 'info', 'decision'].map((kind) => (
                      <option key={kind}>{kind}</option>
                    ))}
                  </select>
                  <InlineText
                    value={need.waitingOn}
                    placeholder="Waiting on someone?"
                    onSave={(text) =>
                      editEntry(item.id, 'needs', need, { ...need, waitingOn: text || undefined })
                    }
                  />
                </div>
                {need.waitingOn && !need.satisfied ? (
                  <button
                    className="text-action"
                    onClick={() =>
                      run(() => addNote(item.id, `Followed up with ${need.waitingOn}.`, viewer))
                    }
                  >
                    Log a follow-up
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <InlineText placeholder="Add a need…" onSave={(text) => add('needs', text)} />
        </DocumentSection>
      ) : null}
      {show('questions') ? (
        <DocumentSection title="Open questions">
          <ul className="document-list">
            {item.questions.map((question) => (
              <li key={question.id}>
                <InlineText
                  value={question.text}
                  placeholder="Edit question"
                  onSave={(text) =>
                    editEntry(item.id, 'questions', question, { ...question, text })
                  }
                />
                <InlineText
                  placeholder="Answer and make a decision…"
                  multiline
                  onSave={(text) => answerQuestion(item.id, question, text)}
                />
              </li>
            ))}
          </ul>
          <InlineText placeholder="Add a question…" onSave={(text) => add('questions', text)} />
        </DocumentSection>
      ) : null}
      {show('decisions') ? (
        <DocumentSection title="Decisions">
          <ul className="document-list">
            {item.decisions.map((decision) => (
              <li key={decision.id}>
                <InlineText
                  value={decision.text}
                  placeholder="Edit decision"
                  multiline
                  onSave={(text) =>
                    editEntry(item.id, 'decisions', decision, { ...decision, text })
                  }
                />
                {decision.rationale ? <p className="secondary">{decision.rationale}</p> : null}
              </li>
            ))}
          </ul>
          <InlineText placeholder="Add a decision…" onSave={(text) => add('decisions', text)} />
        </DocumentSection>
      ) : null}
      {show('steps') ? (
        <DocumentSection title="Steps">
          <ul className="document-list">
            {item.steps.map((step) => (
              <li key={step.id} className="check-row">
                <input
                  type="checkbox"
                  aria-label={`Complete step: ${step.text}`}
                  checked={step.done}
                  onChange={() =>
                    run(() => editEntry(item.id, 'steps', step, { ...step, done: !step.done }))
                  }
                />
                <InlineText
                  className={step.done ? 'done-text' : ''}
                  value={step.text}
                  placeholder="Edit step"
                  onSave={(text) => editEntry(item.id, 'steps', step, { ...step, text })}
                />
              </li>
            ))}
          </ul>
          <InlineText placeholder="Add a step…" onSave={(text) => add('steps', text)} />
        </DocumentSection>
      ) : null}
      <DocumentSection title="Log">
        <InlineText
          placeholder="Add a note…"
          multiline
          onSave={(text) => addNote(item.id, text, viewer)}
        />
        <ol className="log-list">
          {[...new Map([...log, ...older].map((entry) => [entry.id, entry])).values()].map(
            (entry) => (
              <li key={entry.id}>
                <div className="log-attribution">
                  <time dateTime={entry.at}>{shortDate(entry.at.slice(0, 10))}</time>
                  <span>
                    {entry.kind === 'capture'
                      ? 'Captured'
                      : entry.kind === 'migrated'
                        ? 'Imported'
                        : (people.find((person) => person.uid === entry.by)?.name ??
                          (entry.by === viewer.uid ? profile.name.split(' ')[0] : entry.by))}
                  </span>
                </div>
                <p>{entry.text}</p>
              </li>
            ),
          )}
        </ol>
        {hasOlder && cursor ? (
          <button
            className="text-action"
            onClick={() =>
              run(async () => {
                const page = await olderLog(item.id, cursor);
                setOlder((previous) => [...previous, ...page.rows]);
                setCursor(page.cursor);
                setHasOlder(page.rows.length === 20);
              })
            }
          >
            Show older
          </button>
        ) : null}
      </DocumentSection>
      {show('links') ? (
        <DocumentSection title="Links">
          <ul className="document-list">
            {item.links.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
                <span className="mono link-kind">{link.kind}</span>
              </li>
            ))}
          </ul>
          <AddLink item={item} />
        </DocumentSection>
      ) : null}
      <div className="add-section">
        <label className="sr-only" htmlFor="add-section">
          Add a section
        </label>
        <select
          id="add-section"
          value={revealed}
          onChange={(event) => setRevealed(event.target.value as OptionalSection)}
        >
          <option value="">Add details…</option>
          {(
            [
              ['intent', 'Why'],
              ['nextAction', 'Next action'],
              ['dates', 'Dates'],
              ['needs', 'Needs'],
              ['questions', 'Open questions'],
              ['decisions', 'Decisions'],
              ['steps', 'Steps'],
              ['links', 'Links'],
            ] as const
          )
            .filter(([key]) => !show(key))
            .map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          {revealed ? <option value={revealed}>Adding {revealed}…</option> : null}
        </select>
      </div>
      <details className="item-settings">
        <summary>
          Item settings <ChevronDown size={16} />
        </summary>
        <div className="settings-fields">
          <label>
            Category
            <select
              value={item.category}
              onChange={(event) =>
                run(() =>
                  updateFields(item, { category: event.target.value as Item['category'] }, viewer),
                )
              }
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select
              value={item.scope}
              onChange={(event) =>
                run(() =>
                  updateFields(
                    item,
                    {
                      scope: event.target.value as Item['scope'],
                      ...(event.target.value === 'private'
                        ? {
                            ownerPersonIds: [...new Set([...item.ownerPersonIds, viewer.personId])],
                          }
                        : {}),
                    },
                    viewer,
                  ),
                )
              }
            >
              <option value="private">Private to owners</option>
              <option value="household">Household</option>
            </select>
          </label>
          <fieldset>
            <legend>Owners</legend>
            {activePeople.map((person) => (
              <label key={person.id} className="check-row">
                <input
                  type="checkbox"
                  checked={item.ownerPersonIds.includes(person.id)}
                  onChange={() =>
                    run(() =>
                      updateFields(
                        item,
                        {
                          ownerPersonIds: item.ownerPersonIds.includes(person.id)
                            ? item.ownerPersonIds.filter((id) => id !== person.id)
                            : [...item.ownerPersonIds, person.id],
                        },
                        viewer,
                      ),
                    )
                  }
                />
                <span className="owner-dot" style={{ background: person.color }} />
                {person.name}
              </label>
            ))}
          </fieldset>
          <label>
            Effort
            <select
              value={item.effort}
              onChange={(event) =>
                run(() =>
                  updateFields(item, { effort: event.target.value as Item['effort'] }, viewer),
                )
              }
            >
              {Object.entries(effortLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Focus
            <select
              value={item.focus}
              onChange={(event) =>
                run(() =>
                  updateFields(item, { focus: event.target.value as Item['focus'] }, viewer),
                )
              }
            >
              {['low', 'normal', 'high'].map((focus) => (
                <option key={focus}>{focus}</option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Contexts</legend>
            {contexts.map((context) => (
              <label className="check-row" key={context}>
                <input
                  type="checkbox"
                  checked={item.contexts.includes(context)}
                  onChange={() =>
                    run(() =>
                      updateFields(
                        item,
                        {
                          contexts: item.contexts.includes(context)
                            ? item.contexts.filter((value) => value !== context)
                            : [...item.contexts, context],
                        },
                        viewer,
                      ),
                    )
                  }
                />
                {context}
              </label>
            ))}
          </fieldset>
          <label className="check-row">
            <input
              type="checkbox"
              checked={item.businessHours}
              onChange={(event) =>
                run(() => updateFields(item, { businessHours: event.target.checked }, viewer))
              }
            />
            Needs weekday business hours
          </label>
          <InlineText
            value={item.outcome}
            placeholder="What does done look like?"
            onSave={(text) => field('outcome', text)}
          />
          <RecurrenceEditor
            item={item}
            save={(recurrence) => updateFields(item, { recurrence }, viewer)}
          />
          <button
            onClick={() =>
              run(() => updateFields(item, { status: 'cancelled' }, viewer, 'Cancelled.'))
            }
          >
            Cancel item
          </button>
        </div>
      </details>
    </main>
  );
}
function AddLink({ item }: { item: Item }) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  if (!open)
    return (
      <button className="inline-text placeholder" onClick={() => setOpen(true)}>
        Add a link…
      </button>
    );
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          const url = String(data.get('url'));
          await addEntry(item, 'links', {
            id: newId(),
            url,
            label: String(data.get('label')) || new URL(url).hostname,
            kind: String(data.get('kind')) as 'chat' | 'reference' | 'hearth',
          });
          setOpen(false);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save link.');
        }
      }}
    >
      <input
        autoFocus
        name="url"
        type="url"
        placeholder="https://"
        aria-label="Link URL"
        required
      />
      <input name="label" placeholder="Label" aria-label="Link label" />
      <select name="kind" aria-label="Link kind">
        <option value="reference">Reference</option>
        <option value="chat">Chat</option>
        <option value="hearth">Hearth</option>
      </select>
      <div className="inline-actions">
        <button>Save link</button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
function RecurrenceEditor({
  item,
  save,
}: {
  item: Item;
  save: (recurrence: Item['recurrence'] | null) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  if (!open)
    return (
      <button className="inline-text" onClick={() => setOpen(true)}>
        {item.recurrence
          ? item.recurrence.kind === 'afterCompletion'
            ? `Repeats ${item.recurrence.intervalDays} days after completion`
            : `Repeats: ${item.recurrence.rule}`
          : 'Add recurrence…'}
      </button>
    );
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget),
          kind = String(data.get('kind'));
        const start = String(data.get('start')),
          end = String(data.get('end'));
        try {
          if (Boolean(start) !== Boolean(end)) throw new Error('Set both season dates.');
          const season = start && end ? { start, end } : undefined;
          await save(
            kind === 'none'
              ? null
              : kind === 'calendar'
                ? { kind, rule: String(data.get('rule')), season }
                : { kind: 'afterCompletion', intervalDays: Number(data.get('interval')), season },
          );
          setOpen(false);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save recurrence.');
        }
      }}
    >
      <label>
        Repeats
        <select name="kind" defaultValue={item.recurrence?.kind ?? 'afterCompletion'}>
          <option value="afterCompletion">After completion</option>
          <option value="calendar">Calendar rule</option>
          <option value="none">Does not repeat</option>
        </select>
      </label>
      <label>
        Days after completion
        <input
          name="interval"
          type="number"
          min={1}
          max={3650}
          defaultValue={
            item.recurrence?.kind === 'afterCompletion' ? item.recurrence.intervalDays : 7
          }
        />
      </label>
      <label>
        Calendar rule
        <input
          name="rule"
          defaultValue={
            item.recurrence?.kind === 'calendar' ? item.recurrence.rule : 'FREQ=WEEKLY;BYDAY=SA'
          }
        />
      </label>
      <label>
        Season starts (MM-DD)
        <input name="start" defaultValue={item.recurrence?.season?.start} placeholder="04-01" />
      </label>
      <label>
        Season ends (MM-DD)
        <input name="end" defaultValue={item.recurrence?.season?.end} placeholder="10-31" />
      </label>
      <div className="inline-actions">
        <button>Save recurrence</button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
