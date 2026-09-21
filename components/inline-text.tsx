'use client';
import { useState } from 'react';
export function InlineText({
  value,
  placeholder,
  onSave,
  multiline = false,
  className = '',
  label,
}: {
  value?: string;
  placeholder: string;
  onSave: (text: string) => Promise<unknown>;
  multiline?: boolean;
  className?: string;
  label?: string;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(value ?? ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!editing)
    return (
      <button
        className={`inline-text ${value ? '' : 'placeholder'} ${className}`}
        aria-label={label ?? placeholder}
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
        }}
      >
        {value || placeholder}
      </button>
    );
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
          await onSave(draft.trim());
          setEditing(false);
          setDraft('');
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {multiline ? (
        <textarea
          autoFocus
          aria-label={label ?? placeholder}
          value={draft}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
        />
      ) : (
        <input
          autoFocus
          aria-label={label ?? placeholder}
          value={draft}
          maxLength={500}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      <div className="inline-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
