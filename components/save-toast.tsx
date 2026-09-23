'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Check, X } from 'lucide-react';

const SaveToastContext = createContext<{ saved: () => void; clear: () => void } | null>(null);

export function SaveToastProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<{ id: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const saved = useCallback(
    () => setNotification((current) => ({ id: (current?.id ?? 0) + 1 })),
    [],
  );
  const clear = useCallback(() => {
    setNotification(null);
    setHovered(false);
    setFocused(false);
  }, []);
  const actions = useMemo(() => ({ saved, clear }), [saved, clear]);

  useEffect(() => {
    if (!notification || hovered || focused) return;
    const timer = window.setTimeout(clear, 7_000);
    return () => window.clearTimeout(timer);
  }, [notification, hovered, focused, clear]);

  return (
    <SaveToastContext value={actions}>
      {children}
      <div className="save-toast-region">
        <div role="status" aria-live="polite" aria-atomic="true">
          {notification ? (
            <div
              className="save-toast"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            >
              <Check size={19} className="save-toast-check" aria-hidden="true" />
              <span key={notification.id}>Changes saved</span>
              <button type="button" aria-label="Dismiss save confirmation" onClick={clear}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </SaveToastContext>
  );
}

export function useSaveToast() {
  const context = useContext(SaveToastContext);
  if (!context) throw new Error('useSaveToast requires SaveToastProvider.');
  return context;
}
