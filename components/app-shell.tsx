'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Plus, List, ArrowUpRight, CalendarDays, CheckCheck, LogOut } from 'lucide-react';
import { logout, useSession } from './auth-provider';
import { CaptureSheet } from './capture-sheet';
export function AppShell({ children }: { children: ReactNode }) {
  const [captureOpen, setCaptureOpen] = useState(false),
    [message, setMessage] = useState('');
  const { profile } = useSession();
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !target.closest('input, textarea, select, [contenteditable], dialog[open]')
      ) {
        event.preventDefault();
        setCaptureOpen(true);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="wordmark" href="/">
          Mitos
        </Link>
        <div className="account">
          <span>{profile.name.split(' ')[0]}</span>
          <button
            onClick={() => logout().catch((error) => setMessage(error.message))}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
      {message ? (
        <div className="notice" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}
      {children}
      <button
        className="capture-fab"
        onClick={() => setCaptureOpen(true)}
        aria-label="Capture an item"
      >
        <Plus size={22} strokeWidth={1.8} />
      </button>
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link href="/" className="selected">
          <List size={16} />
          <span>Everything</span>
        </Link>
        <button disabled title="After the design checkpoint">
          <ArrowUpRight size={16} />
          <span>Ready</span>
        </button>
        <button disabled title="After the design checkpoint">
          <CalendarDays size={16} />
          <span>Due</span>
        </button>
        <button disabled title="After the design checkpoint">
          <CheckCheck size={16} />
          <span>Review</span>
        </button>
      </nav>
      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSaved={() => setMessage('Saved to Inbox.')}
        onError={(error) => setMessage(`Capture could not sync: ${error.message}`)}
      />
    </div>
  );
}
