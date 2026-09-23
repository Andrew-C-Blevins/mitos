'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useModalDialog } from './use-modal-dialog';
import { useSession } from './auth-provider';
import { capture } from '@/lib/data/client/items';
import { CAPTURE_LIMIT } from '@/lib/domain/input';
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
    input = useRef<HTMLTextAreaElement>(null),
    [text, setText] = useState('');
  const { viewer } = useSession();
  useModalDialog(open, dialog);
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="capture-sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
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
        <textarea
          ref={input}
          autoFocus
          aria-label="What’s on your mind?"
          placeholder="What’s on your mind?"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          aria-describedby="capture-help"
          required
        />
        <p id="capture-help" className="secondary">
          Paste an idea or a whole list. The full text is kept; the first line becomes the title.
        </p>
        {text.length > 4000 ? (
          <p className="secondary" role="status">
            {text.length.toLocaleString()} / {CAPTURE_LIMIT.toLocaleString()} characters
          </p>
        ) : null}
        {text.length > CAPTURE_LIMIT ? (
          <p role="alert">Split this into smaller captures to save all of it.</p>
        ) : null}
        <button className="primary-button" disabled={!text.trim() || text.length > CAPTURE_LIMIT}>
          Save to Inbox
        </button>
      </form>
    </dialog>
  );
}
