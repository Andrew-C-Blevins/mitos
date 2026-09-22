'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from './auth-provider';
import { subscribePeople, subscribeHousehold, updatePerson } from '@/lib/data/client/people';
import { setDefaultContext } from '@/lib/data/client/profile';
import { contexts, type Context, type Person, type Household } from '@/lib/types';
import { personColors, type PersonChange } from '@/lib/domain/people';
import { SaveFeedback } from './save-feedback';

export function SettingsScreen() {
  const { user, profile, viewer } = useSession();
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function saveContext(context: Context | '') {
    setPending('context');
    setMessage('');
    setError('');
    try {
      await setDefaultContext(user.uid, context);
      setMessage('Default context saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setPending('');
    }
  }
  async function download() {
    setPending('export');
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/export', {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Export failed.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `mitos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Your export is ready. Check your downloads.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export failed.');
    } finally {
      setPending('');
    }
  }
  return (
    <div className="settings-page">
      <div className="settings-heading">
        <h1>Settings</h1>
        <Link href="/" aria-label="Close settings">
          <X size={22} />
        </Link>
      </div>
      <p className="secondary">Changes save as you make them.</p>
      <div className="settings-feedback">
        <SaveFeedback message={pending ? 'Saving…' : error || message} error={Boolean(error)} />
      </div>
      <section className="settings-section" aria-labelledby="people-heading">
        <h2 id="people-heading">Household people</h2>
        <p>Everyone can choose their own color. Admins manage household members.</p>
        {viewer.householdIds.map((id) => (
          <HouseholdPeople
            key={id}
            householdId={id}
            onSaved={(message) => {
              setError('');
              setMessage(message);
            }}
          />
        ))}
      </section>
      <section className="settings-section" aria-labelledby="context-heading">
        <h2 id="context-heading">Your default context</h2>
        <p>
          Where you usually get things done. This will be the starting filter for Ready when it’s
          available.
        </p>
        <label className="context-setting">
          Context
          <select
            value={profile.defaultContext ?? ''}
            disabled={Boolean(pending)}
            onChange={(event) => saveContext(event.target.value as Context | '')}
          >
            <option value="">Any context</option>
            {contexts.map((context) => (
              <option key={context} value={context}>
                {context[0].toUpperCase() + context.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="settings-section" aria-labelledby="export-heading">
        <h2 id="export-heading">Your data</h2>
        <p>
          Download your private items and shared household items, including completed items,
          history, proposals and people, as a JSON file.
        </p>
        <button className="export-button" disabled={Boolean(pending)} onClick={download}>
          <Download size={18} />
          {pending === 'export' ? 'Preparing export…' : 'Export data'}
        </button>
      </section>
      <Link className="settings-done primary-button" href="/">
        Done
      </Link>
    </div>
  );
}

function HouseholdPeople({
  householdId,
  onSaved,
}: {
  householdId: string;
  onSaved: (message: string) => void;
}) {
  const { viewer } = useSession();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  useEffect(
    () => subscribePeople(householdId, setPeople, (caught) => setError(caught.message)),
    [householdId],
  );
  useEffect(
    () => subscribeHousehold(householdId, setHousehold, (caught) => setError(caught.message)),
    [householdId],
  );
  const isAdmin = Boolean(household?.adminUids?.includes(viewer.uid));
  async function change(person: Person, change: PersonChange) {
    setPending(person.id);
    setError('');
    onSaved('');
    try {
      await updatePerson(person.id, change);
      onSaved(
        change.action === 'color'
          ? 'Your color is saved.'
          : change.action === 'delete'
            ? 'Archived person removed.'
            : 'Household changes saved.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this person.');
    } finally {
      setPending('');
    }
  }
  function rows(source: Person[]) {
    return (
      <ul className="people-settings">
        {source
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((person) => (
            <li key={person.id}>
              <span className="person-swatch" style={{ background: person.color }} />
              <span className="person-label">
                {person.name}
                {person.id === viewer.personId ? ' (you)' : ''}
                <small>
                  {person.status === 'archived'
                    ? 'Archived'
                    : household?.adminUids?.includes(person.uid ?? '')
                      ? 'Admin'
                      : 'User'}
                </small>
              </span>
              {isAdmin ? (
                <details className="person-controls">
                  <summary>Manage</summary>
                  {person.status === 'active' && person.uid ? (
                    <label>
                      Role
                      <select
                        aria-label={`Role for ${person.name}`}
                        disabled={Boolean(pending)}
                        value={household?.adminUids?.includes(person.uid) ? 'admin' : 'user'}
                        onChange={(event) =>
                          change(person, {
                            action: 'role',
                            value: event.target.value as 'admin' | 'user',
                          })
                        }
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                  ) : null}
                  <button
                    disabled={Boolean(pending)}
                    onClick={() => {
                      if (
                        person.uid &&
                        person.status === 'active' &&
                        !window.confirm(
                          `Archive ${person.name}? This removes their household access. Their item history will remain.`,
                        )
                      )
                        return;
                      void change(person, {
                        action: 'status',
                        value: person.status === 'active' ? 'archived' : 'active',
                      });
                    }}
                  >
                    {person.status === 'active' ? 'Archive' : 'Restore'}
                  </button>
                  {person.status === 'archived' && !person.uid ? (
                    <button
                      disabled={Boolean(pending)}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete the archived person ${person.name}? This is allowed only if no item refers to them.`,
                          )
                        )
                          void change(person, { action: 'delete' });
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </details>
              ) : null}
            </li>
          ))}
      </ul>
    );
  }
  return (
    <>
      {people ? (
        <>
          {rows(people.filter((person) => person.status === 'active'))}
          <fieldset className="color-picker">
            <legend>Your color</legend>
            {personColors.map((color) => {
              const mine = people.find((person) => person.id === viewer.personId);
              const taken = people.some(
                (person) =>
                  person.id !== viewer.personId &&
                  person.status === 'active' &&
                  person.color.toLowerCase() === color.value,
              );
              return (
                <button
                  key={color.value}
                  type="button"
                  style={{ '--swatch': color.value } as React.CSSProperties}
                  className="color-choice"
                  aria-label={`${color.label}${taken ? ' (in use)' : ''}`}
                  aria-pressed={mine?.color.toLowerCase() === color.value}
                  disabled={Boolean(pending) || taken || !mine}
                  onClick={() => mine && change(mine, { action: 'color', value: color.value })}
                >
                  <span />
                  {color.label}
                </button>
              );
            })}
          </fieldset>
          {isAdmin && people.some((person) => person.status === 'archived') ? (
            <details className="archived-people">
              <summary>Archived people</summary>
              <p>Archived members have no household access. Their history is preserved.</p>
              {rows(people.filter((person) => person.status === 'archived'))}
            </details>
          ) : null}
        </>
      ) : (
        <p role="status">Loading people…</p>
      )}
      {pending ? <SaveFeedback message="Saving…" /> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
