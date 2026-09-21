'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSession } from './auth-provider';
import { capture } from '@/lib/data/client/items';
export function CaptureSheet({
  open,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (error: Error) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    [text, setText] = useState('');
  const { viewer } = useSession();
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      input.current?.focus();
    } else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="capture-sheet"
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="capture-heading"
    >
      <div className="sheet-heading">
        <h2 id="capture-heading">Capture</h2>
        <button type="button" aria-label="Close capture" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          try {
            capture(text, viewer, onError);
            setText('');
            onSaved();
            onClose();
          } catch (error) {
            onError(error as Error);
          }
        }}
      >
        <input
          ref={input}
          autoFocus
          aria-label="What’s on your mind?"
          placeholder="What’s on your mind?"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
          required
        />
        <button className="primary-button" disabled={!text.trim()}>
          Save
        </button>
      </form>
    </dialog>
  );
}
