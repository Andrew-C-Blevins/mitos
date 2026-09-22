'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Item } from '@/lib/types';
import { deleteItem } from '@/lib/data/client/items';
import { saveError } from '@/lib/domain/input';

export function DeleteItemDialog({
  item,
  onClose,
  onDeleted,
}: {
  item: Item;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId(),
    description = useId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="capture-sheet delete-dialog"
      aria-labelledby={heading}
      aria-describedby={description}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={heading}>Delete this to-do?</h2>
      <p className="delete-title">{item.title}</p>
      <p id={description}>
        Permanently deletes this to-do, its steps, notes, and history. This cannot be undone.
      </p>
      {item.scope === 'household' ? <p>It will be removed for everyone in the household.</p> : null}
      <p>Any separate sub-items will be kept.</p>
      <div className="delete-dialog-actions">
        <button autoFocus disabled={busy} onClick={onClose}>
          Keep to-do
        </button>
        <button
          className="danger-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await deleteItem(item);
              onDeleted();
            } catch (caught) {
              setError(saveError(caught));
              setBusy(false);
            }
          }}
        >
          {busy ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </dialog>
  );
}
