'use client';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Item } from '@/lib/types';
import { getFirebase } from '@/lib/data/client/firebase';
import { itemHref } from '@/lib/domain/item-links';
import { EverythingScreen } from './everything-screen';
import { ItemScreen } from './item-screen';
import { PlannerLink, PlannerNavigation } from './planner-navigation';

export function PlannerWorkspace() {
  const pathname = usePathname();
  const routeId = pathname.startsWith('/items/') ? pathname.slice(7) : '';
  const [items, setItems] = useState<Item[]>([]);
  const listPosition = useRef(0);
  const pane = useRef<HTMLDivElement>(null);
  const navigate = useCallback((href: string, replace = false) => {
    if (window.location.pathname === '/') listPosition.current = window.scrollY;
    if (href !== window.location.pathname)
      window.history[replace ? 'replaceState' : 'pushState'](null, '', href);
  }, []);
  useEffect(() => {
    const remember = () => {
      if (window.location.pathname === '/' && document.body.style.position !== 'fixed')
        listPosition.current = window.scrollY;
    };
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      window.removeEventListener('scroll', remember);
      window.history.scrollRestoration = previous;
    };
  }, []);
  useLayoutEffect(() => {
    window.scrollTo({ top: routeId ? 0 : listPosition.current, behavior: 'instant' });
    if (routeId) pane.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [routeId]);
  return (
    <PlannerNavigation value={navigate}>
      <div className={`planner-workspace ${routeId ? 'item-open' : ''}`}>
        <div className="list-pane">
          <EverythingScreen onItems={setItems} />
        </div>
        <div className="item-pane" ref={pane}>
          {routeId ? (
            <ItemRoute
              key={routeId}
              routeId={routeId}
              known={items.find((item) => item.id === routeId || item.urlId === routeId)}
            />
          ) : (
            <div className="item-placeholder">
              <h2>Your next step starts here.</h2>
              <p>Choose an item to see its details.</p>
            </div>
          )}
        </div>
      </div>
    </PlannerNavigation>
  );
}

function ItemRoute({ routeId, known }: { routeId: string; known?: Item }) {
  const [resolved, setResolved] = useState<Item>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const item = known ?? resolved;
  useEffect(() => {
    if (known) return;
    const controller = new AbortController();
    void (async () => {
      const user = getFirebase().auth.currentUser;
      if (!user) throw new Error('Sign in to open this to-do.');
      const response = await fetch(`/api/items/${encodeURIComponent(routeId)}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not open this to-do.');
      if (!controller.signal.aborted) setResolved(result.item);
    })().catch((caught) => {
      if (!controller.signal.aborted) setError(caught.message);
    });
    return () => controller.abort();
  }, [routeId, known, attempt]);
  useEffect(() => {
    if (item && itemHref(item) !== window.location.pathname)
      window.history.replaceState(null, '', itemHref(item));
  }, [item]);
  if (item) return <ItemScreen key={item.id} id={item.id} initialItem={item} />;
  return (
    <article className="document">
      <PlannerLink className="back-link" href="/">
        ← Back to list
      </PlannerLink>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button
            onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </>
      ) : (
        <p role="status">Opening to-do…</p>
      )}
    </article>
  );
}
