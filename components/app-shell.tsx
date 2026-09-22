'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Plus, List, LogOut, Settings } from 'lucide-react';
import { SaveFeedback } from './save-feedback';
import { logout, useSession } from './auth-provider';
import { CaptureSheet } from './capture-sheet';
import { PlannerWorkspace } from './planner-workspace';
import { Brand } from './brand';
export function AppShell({ children }: { children: ReactNode }) {
  const [captureOpen, setCaptureOpen] = useState(false),
    [message, setMessage] = useState('');
  const { profile } = useSession();
  const pathname = usePathname();
  const plannerOpen = pathname === '/' || pathname.startsWith('/items/');
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
        <Link className="brand-link" href="/" aria-label="Mitos home">
          <Brand />
        </Link>
        <div className="account">
          <span>{profile.name.split(' ')[0]}</span>
          <Link
            href={pathname === '/settings' ? '/' : '/settings'}
            aria-label={pathname === '/settings' ? 'Close settings' : 'Settings'}
            aria-current={pathname === '/settings' ? 'page' : undefined}
          >
            <Settings size={17} />
          </Link>
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
          <SaveFeedback message={message} />
          <button onClick={() => setMessage('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      ) : null}
      <main className="app-content">
        {plannerOpen ? <PlannerWorkspace>{children}</PlannerWorkspace> : children}
      </main>
      <button
        className="capture-fab"
        onClick={() => setCaptureOpen(true)}
        aria-label="Capture an item"
      >
        <Plus size={22} strokeWidth={1.8} />
      </button>
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link
          href="/"
          className={plannerOpen ? 'selected' : ''}
          aria-current={plannerOpen ? 'page' : undefined}
        >
          <List size={16} />
          <span>Everything</span>
        </Link>
        <Link
          href="/settings"
          className={`desktop-settings ${pathname === '/settings' ? 'selected' : ''}`}
          aria-current={pathname === '/settings' ? 'page' : undefined}
        >
          <Settings size={16} />
          <span>Settings</span>
        </Link>
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
