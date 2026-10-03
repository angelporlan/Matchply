'use client';

import { useEffect, useRef, type RefObject } from 'react';

export function useCrmMenu(open: boolean, onClose: () => void, container: RefObject<HTMLDivElement>, trigger: RefObject<HTMLButtonElement>) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === trigger.current) container.current?.querySelector<HTMLButtonElement>('[role="menu"] button:not(:disabled)')?.focus();
    });
    const pointer = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) close.current();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!container.current?.contains(event.target as Node)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
        trigger.current?.focus();
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(container.current.querySelectorAll<HTMLButtonElement>('[role="menu"] button:not(:disabled)'));
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    document.addEventListener('mousedown', pointer);
    document.addEventListener('keydown', keyboard);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', pointer);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open, container, trigger]);
}
