'use client';
import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Person } from '@/lib/types';
import { updatePerson } from '@/lib/data/client/people';
import { useModalDialog } from './use-modal-dialog';

export function DeletePersonDialog({
  person,
  onClose,
  onDeleted,
}: {
  person: Person;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useModalDialog(true, dialog);
  return (
    <dialog
      ref={dialog}
      className="capture-sheet delete-dialog"
      aria-labelledby="delete-person-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="delete-person-heading">Delete archived person?</h2>
      <p className="delete-title">{person.name}</p>
      <p>
        This permanently removes their person record. A person assigned to a to-do cannot be
        deleted.
      </p>
      <div className="delete-dialog-actions">
        <button autoFocus disabled={busy} onClick={onClose}>
          Keep archived
        </button>
        <button
          className="danger-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await updatePerson(person.id, { action: 'delete' });
              onDeleted();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Could not delete this person.');
              setBusy(false);
            }
          }}
        >
          <Trash2 size={16} />
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </dialog>
  );
}
