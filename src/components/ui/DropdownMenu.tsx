'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  label: string;
  align?: 'left' | 'right';
  triggerClassName?: string;
  icon?: React.ReactNode;
}

export default function DropdownMenu({
  items,
  label,
  align = 'right',
  triggerClassName,
  icon,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
      ?.focus();
  }, [open]);

  const focusItem = (direction: 1 | -1 | 'first' | 'last') => {
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (nodes.length === 0) return;

    if (direction === 'first') return nodes[0]?.focus();
    if (direction === 'last') return nodes[nodes.length - 1]?.focus();

    const current = nodes.indexOf(document.activeElement as HTMLElement);
    const next = (current + direction + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'p-1.5 rounded-[8px] border border-transparent text-text-muted transition-colors hover:text-text hover:border-subtle hover:bg-canvas',
          triggerClassName,
        )}
      >
        {icon ?? <MoreHorizontal className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusItem(-1);
            } else if (event.key === 'Home') {
              event.preventDefault();
              focusItem('first');
            } else if (event.key === 'End') {
              event.preventDefault();
              focusItem('last');
            } else if (event.key === 'Tab') {
              setOpen(false);
            }
          }}
          className={cn(
            'absolute z-30 mt-2 min-w-[190px] rounded-[8px] border border-subtle bg-surface shadow-dialog p-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                item.onSelect();
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs font-semibold text-left transition-colors',
                item.destructive
                  ? 'text-danger-text hover:bg-danger-surface'
                  : 'text-text hover:bg-canvas',
                item.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
