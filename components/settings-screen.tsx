'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useSession } from './auth-provider';
import { subscribePeople, setPersonStatus } from '@/lib/data/client/people';
import { setDefaultContext } from '@/lib/data/client/profile';
import { contexts, type Context, type Person } from '@/lib/types';

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
      <h1>Settings</h1>
      <section className="settings-section" aria-labelledby="people-heading">
        <h2 id="people-heading">Household people</h2>
        <p>Archived people stay in your history and leave the owner picker.</p>
        {viewer.householdIds.map((id) => (
          <HouseholdPeople key={id} householdId={id} />
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
      {message ? <p role="status">{message}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function HouseholdPeople({ householdId }: { householdId: string }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  useEffect(
    () => subscribePeople(householdId, setPeople, (caught) => setError(caught.message)),
    [householdId],
  );
  async function toggle(person: Person) {
    setPending(person.id);
    setError('');
    try {
      await setPersonStatus(person.id, person.status === 'active' ? 'archived' : 'active');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this person.');
    } finally {
      setPending('');
    }
  }
  return (
    <>
      {people ? (
        <ul className="people-settings">
          {[...people]
            .sort(
              (a, b) =>
                Number(a.status === 'archived') - Number(b.status === 'archived') ||
                a.name.localeCompare(b.name),
            )
            .map((person) => (
              <li key={person.id}>
                <span className="person-swatch" style={{ background: person.color }} />
                <span className="person-label">
                  {person.name}
                  <small>{person.status === 'active' ? 'Active' : 'Archived'}</small>
                </span>
                <button
                  disabled={Boolean(pending)}
                  onClick={() => toggle(person)}
                  aria-label={`${person.status === 'active' ? 'Archive' : 'Restore'} ${person.name}`}
                >
                  {pending === person.id
                    ? 'Saving…'
                    : person.status === 'active'
                      ? 'Archive'
                      : 'Restore'}
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p role="status">Loading people…</p>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
