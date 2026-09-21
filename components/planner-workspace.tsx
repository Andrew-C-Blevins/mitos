'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { EverythingScreen } from './everything-screen';

export function PlannerWorkspace({ children }: { children: ReactNode }) {
  const itemOpen = usePathname().startsWith('/items/');
  return (
    <div className={`planner-workspace ${itemOpen ? 'item-open' : ''}`}>
      <div className="list-pane">
        <EverythingScreen />
      </div>
      <div className="item-pane">
        {itemOpen ? (
          children
        ) : (
          <div className="item-placeholder">
            <h2>Your next step starts here.</h2>
            <p>Choose an item to see its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
