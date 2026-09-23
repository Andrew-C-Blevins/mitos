'use client';
import { PlannerLink as Link, usePlannerNavigation } from './planner-navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Trash2, X } from 'lucide-react';
import { saveError } from '@/lib/domain/input';
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
  type SectionEntry,
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
import { StepChecklist } from './step-checklist';
import { DeleteItemDialog } from './delete-item-dialog';
import { useSaveToast } from './save-toast';
import { shortDate, dateMark, localDate, addDays } from '@/lib/domain/rules';
import { newId } from '@/lib/domain/ids';
import { previousAction } from '@/lib/domain/steps';
import { useModalDialog } from './use-modal-dialog';
import { SaveToastViewport } from './save-toast';

function DocumentSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`document-section ${className}`}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
type OptionalSection = 'intent' | Section;
export function ItemScreen({ id, initialItem }: { id: string; initialItem?: Item }) {
  const navigate = usePlannerNavigation();
  const { viewer, profile } = useSession();
  const toast = useSaveToast();
  const logInitialized = useRef(false);
  const confirmedVersion = useRef(0);
  const [item, setItem] = useState<Item | null>(initialItem ?? null),
    [loaded, setLoaded] = useState(Boolean(initialItem)),
    [people, setPeople] = useState<Person[]>([]),
    [log, setLog] = useState<LogEntry[]>([]),
    [older, setOlder] = useState<LogEntry[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [hasOlder, setHasOlder] = useState(false),
    [error, setError] = useState(''),
    [revealed, setRevealed] = useState<OptionalSection | ''>(''),
    [deleting, setDeleting] = useState<Item | null>(null),
    [logisticsOpen, setLogisticsOpen] = useState(false);
  const logisticsDialog = useRef<HTMLDialogElement>(null);
  useModalDialog(logisticsOpen, logisticsDialog);
  useEffect(
    () =>
      subscribeItem(
        id,
        (value) => {
          setItem((current) =>
            current && value && value.version < confirmedVersion.current ? current : value,
          );
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
  async function run(action: () => Promise<unknown>, isSave = true) {
    setError('');
    if (isSave) toast.clear();
    try {
      await action();
      if (isSave) toast.saved();
    } catch (caught) {
      setError(saveError(caught));
    }
  }
  async function changeEntry(section: Section, before: SectionEntry, after?: SectionEntry) {
    const saved = await editEntry(id, section, before, after);
    confirmedVersion.current = Math.max(confirmedVersion.current, saved.version);
    // Render the committed result even when the live Listen stream is delayed.
    // Keep any newer update that already arrived from another device.
    setItem((current) =>
      current?.id === saved.id && current.version <= saved.version ? saved : current,
    );
  }
  if (!loaded)
    return (
      <article className="document">
        <p role="status">Opening item…</p>
      </article>
    );
  if (!item)
    return (
      <article className="document">
        <Link href="/">Back to list</Link>
        <p role="alert">{error || 'This item is not available to your account.'}</p>
      </article>
    );
  const activePeople = people.filter((person) => person.status === 'active');
  const today = localDate(
      new Date().toISOString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    mark = dateMark(item, today);
  const field = (key: 'title' | 'intent' | 'outcome', text: string) =>
    updateFields(item, { [key]: text || null }, viewer);
  const show = (section: OptionalSection) =>
    revealed === section ||
    (Array.isArray(item[section]) ? item[section].length > 0 : Boolean(item[section]));
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
    <article className="document">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} /> Back to list
      </Link>
      <div className="item-actions">
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
            Keep in To-dos
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
      <button
        className="logistics-summary"
        aria-label="People & timing"
        aria-haspopup="dialog"
        onClick={() => setLogisticsOpen(true)}
      >
        <span>
          {item.ownerPersonIds
            .map((id) => people.find((person) => person.id === id)?.name)
            .filter(Boolean)
            .join(', ') || (item.ownerPersonIds.length ? 'Assigned' : 'Unassigned')}
        </span>
        <span className={mark?.overdue ? 'overdue' : ''}>
          {item.dueDate ? `Due ${shortDate(item.dueDate)}` : mark?.text}
          <ChevronRight size={16} />
        </span>
      </button>
      <div className={`item-details ${show('steps') ? 'with-thread' : ''}`}>
        {show('steps') ? (
          <DocumentSection title="Steps" className="steps-section">
            <StepChecklist
              steps={item.steps}
              onToggle={(step) =>
                run(() => changeEntry('steps', step, { ...step, done: !step.done }))
              }
              onEdit={(before, after) => changeEntry('steps', before, after)}
            />
            {item.steps.length > 0 &&
            item.steps.every((step) => step.done) &&
            item.status === 'active' ? (
              <p className="steps-finished">
                All steps checked.{' '}
                <button onClick={() => run(() => complete(item, viewer))}>Complete to-do</button>
              </p>
            ) : null}
            <InlineText placeholder="Add a step…" onSave={(text) => add('steps', text)} />
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
                          changeEntry('needs', need, {
                            ...need,
                            satisfied: !need.satisfied,
                          }),
                        )
                      }
                    />
                    <InlineText
                      value={need.text}
                      placeholder="Edit need"
                      onSave={(text) => changeEntry('needs', need, { ...need, text })}
                      onDelete={() => changeEntry('needs', need)}
                    />
                  </div>
                  <div className="need-meta">
                    <select
                      aria-label={`Kind of ${need.text}`}
                      value={need.kind}
                      onChange={(event) =>
                        run(() =>
                          changeEntry('needs', need, {
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
                        changeEntry('needs', need, { ...need, waitingOn: text || undefined })
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
                    onDelete={() => changeEntry('questions', question)}
                    onSave={(text) => changeEntry('questions', question, { ...question, text })}
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
                    onDelete={() => changeEntry('decisions', decision)}
                    multiline
                    onSave={(text) => changeEntry('decisions', decision, { ...decision, text })}
                  />
                  {decision.rationale ? <p className="secondary">{decision.rationale}</p> : null}
                </li>
              ))}
            </ul>
            <InlineText placeholder="Add a decision…" onSave={(text) => add('decisions', text)} />
          </DocumentSection>
        ) : null}
      </div>
      <DocumentSection title="Notes & history">
        <InlineText
          placeholder="Add a note…"
          multiline
          onSave={(text) => addNote(item.id, text, viewer)}
        />
        {previousAction(item) ? (
          <details className="history-disclosure previous-action">
            <summary>Previous action note</summary>
            <p>{previousAction(item)}</p>
            <p className="secondary">
              Kept from the former Next action field. Your checklist now determines the next step.
            </p>
          </details>
        ) : null}
        <details className="history-disclosure">
          <summary>Show notes and original capture ({log.length + older.length})</summary>
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
                }, false)
              }
            >
              Show older
            </button>
          ) : null}
        </details>
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
      <div className="footer-actions">
        <button className="footer-action delete-entry" onClick={() => setDeleting(item)}>
          <Trash2 size={16} aria-hidden="true" /> Delete
        </button>
        <Link className="footer-action" href="/">
          Done
        </Link>
      </div>
      <dialog
        ref={logisticsDialog}
        className="capture-sheet logistics-sheet"
        aria-labelledby="logistics-heading"
        onCancel={(event) => {
          event.preventDefault();
          setLogisticsOpen(false);
        }}
      >
        <div className="sheet-heading">
          <h2 id="logistics-heading">People & timing</h2>
          <button
            autoFocus
            type="button"
            aria-label="Close people and timing"
            onClick={() => setLogisticsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="notice">
            {error}
          </p>
        ) : null}
        <DocumentSection title="People">
          <div className="settings-fields item-people">
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
                              ownerPersonIds: [
                                ...new Set([...item.ownerPersonIds, viewer.personId]),
                              ],
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
              <legend>Assigned to</legend>
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
          </div>
        </DocumentSection>
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
          <div className="inline-actions date-shortcuts">
            <button
              onClick={() =>
                run(() => updateFields(item, { snoozeUntil: addDays(today, 7) }, viewer))
              }
            >
              Snooze 1 week
            </button>
            {item.snoozeUntil ? (
              <button onClick={() => run(() => updateFields(item, { snoozeUntil: null }, viewer))}>
                Unsnooze
              </button>
            ) : null}
          </div>
        </DocumentSection>

        <SaveToastViewport />
      </dialog>
      {deleting ? (
        <DeleteItemDialog
          item={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => navigate('/', true)}
        />
      ) : null}
    </article>
  );
}
function AddLink({ item }: { item: Item }) {
  const toast = useSaveToast();
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
        toast.clear();
        try {
          const url = String(data.get('url'));
          await addEntry(item, 'links', {
            id: newId(),
            url,
            label: String(data.get('label')) || new URL(url).hostname,
            kind: String(data.get('kind')) as 'chat' | 'reference' | 'hearth',
          });
          toast.saved();
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
  const toast = useSaveToast();
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
        toast.clear();
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
          toast.saved();
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
