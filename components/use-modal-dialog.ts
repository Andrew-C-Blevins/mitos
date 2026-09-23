'use client';
import { useLayoutEffect, type RefObject } from 'react';

let locks = 0;
let restore: (() => void) | undefined;

// A native modal blocks clicks behind it, but does not lock iOS page scrolling.
export function useModalDialog(open: boolean, ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    if (locks++ === 0) {
      const body = document.body;
      const before = body.style.cssText;
      const x = window.scrollX,
        y = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${y}px`;
      body.style.left = `-${x}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      restore = () => {
        body.style.cssText = before;
        window.scrollTo({ left: x, top: y, behavior: 'instant' });
      };
    }
    const viewport = window.visualViewport;
    const resize = () => {
      dialog.style.setProperty('--sheet-height', `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty('--sheet-top', `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    dialog.showModal();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      dialog.close();
      if (--locks === 0) {
        restore?.();
        restore = undefined;
      }
    };
  }, [open, ref]);
}
