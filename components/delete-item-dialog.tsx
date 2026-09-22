'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Item } from '@/lib/types';
import { deleteItem, subscribeItems } from '@/lib/data/client/items';
import { saveError } from '@/lib/domain/input';
import { useSession } from './auth-provider';

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
  const { viewer } = useSession();
  const heading = useId(),
    description = useId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [hasNestedItems, setHasNestedItems] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(
    () =>
      subscribeItems(
        viewer,
        (items) => setHasNestedItems(items.some((child) => child.parentId === item.id)),
        (caught) => setError(saveError(caught)),
      ),
    [item.id, viewer],
  );
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
      {hasNestedItems ? (
        <p>
          Nested to-dos will stay in Everything as separate entries. Checklist steps are deleted
          with this to-do.
        </p>
      ) : null}
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
          <Trash2 size={16} aria-hidden="true" />
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </dialog>
  );
}
