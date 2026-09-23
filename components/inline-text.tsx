'use client';
import { useState } from 'react';
import { saveError } from '@/lib/domain/input';
import { useSaveToast } from './save-toast';
export function InlineText({
  value,
  placeholder,
  onSave,
  multiline = false,
  className = '',
  label,
  onDelete,
  maxLength = multiline ? 4000 : 500,
}: {
  value?: string;
  placeholder: string;
  onSave: (text: string) => Promise<unknown>;
  multiline?: boolean;
  className?: string;
  label?: string;
  onDelete?: () => Promise<unknown>;
  maxLength?: number;
}) {
  const toast = useSaveToast();
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
        toast.clear();
        try {
          if (draft.length > maxLength)
            throw new Error(
              `Keep this entry within ${maxLength.toLocaleString()} characters. Put extra detail in a note.`,
            );
          if (onDelete && !draft.trim())
            throw new Error('Enter text, or use Delete to remove this entry.');
          await onSave(draft.trim());
          toast.saved();
          setEditing(false);
          setDraft('');
        } catch (caught) {
          setError(saveError(caught));
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
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
        />
      ) : (
        <input
          autoFocus
          aria-label={label ?? placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      <div className="inline-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={busy} onClick={() => setEditing(false)}>
          Cancel
        </button>
        {onDelete ? (
          <button
            type="button"
            className="delete-entry"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              toast.clear();
              try {
                await onDelete();
                toast.saved();
                setEditing(false);
              } catch (caught) {
                setError(saveError(caught));
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
      {draft.length > maxLength * 0.8 ? (
        <p className="secondary">
          {draft.length.toLocaleString()} / {maxLength.toLocaleString()} characters
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
