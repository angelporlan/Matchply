"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Columns3, RotateCcw } from 'lucide-react';
import {
  APPLICATION_COLUMN_IDS,
  DEFAULT_APPLICATION_COLUMNS,
  type ApplicationColumnId,
} from '@/lib/application-views';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface ApplicationColumnsMenuProps {
  visibleColumns: ApplicationColumnId[];
  onChange: (columns: ApplicationColumnId[]) => void;
}

export default function ApplicationColumnsMenu({ visibleColumns, onChange }: ApplicationColumnsMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const toggle = (column: ApplicationColumnId) => {
    if (visibleColumns.includes(column)) {
      if (visibleColumns.length === 1) return;
      onChange(visibleColumns.filter((item) => item !== column));
      return;
    }
    const ordered = APPLICATION_COLUMN_IDS.filter(
      (item) => visibleColumns.includes(item) || item === column,
    );
    onChange([...ordered]);
  };

  const move = (column: ApplicationColumnId, direction: -1 | 1) => {
    const index = visibleColumns.indexOf(column);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= visibleColumns.length) return;
    const next = [...visibleColumns];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const label = (column: ApplicationColumnId) => t(`applications.columns.labels.${column}`);

  return (
    <div ref={containerRef} className="relative font-display">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border border-subtle bg-surface text-xs font-bold text-text-muted hover:text-text dark:hover:text-white transition-all shadow-sm"
      >
        <Columns3 className="w-3.5 h-3.5 stroke-[1.75]" />
        {t('applications.columns.menu')}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-canvas dark:bg-surface-muted border border-subtle">
          {visibleColumns.length}
        </span>
      </button>

      {isOpen && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-[12px] border border-subtle bg-surface p-2 shadow-xl animate-in fade-in duration-100">
          <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {t('applications.columns.menuTitle')}
          </p>
          <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-custom">
            {APPLICATION_COLUMN_IDS.map((column) => {
              const isVisible = visibleColumns.includes(column);
              return (
                <div key={column} className="flex items-center gap-1 rounded-[8px] hover:bg-canvas dark:hover:bg-surface-muted transition-colors">
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isVisible}
                    onClick={() => toggle(column)}
                    className="flex-1 flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-text-muted hover:text-text transition-colors min-w-0"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isVisible ? 'bg-ai-action border-ai-action' : 'border-control'}`}>
                      {isVisible && <Check className="w-3 h-3 text-on-ai-action stroke-[3]" />}
                    </span>
                    <span className="truncate">{label(column)}</span>
                  </button>
                  {isVisible && (
                    <span className="flex items-center gap-0.5 pr-1.5">
                      <button
                        type="button"
                        onClick={() => move(column, -1)}
                        disabled={visibleColumns.indexOf(column) === 0}
                        aria-label={t('applications.columns.moveUp')}
                        className="p-1 rounded-md text-text-muted hover:text-text disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp className="w-3 h-3 stroke-[2]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(column, 1)}
                        disabled={visibleColumns.indexOf(column) === visibleColumns.length - 1}
                        aria-label={t('applications.columns.moveDown')}
                        className="p-1 rounded-md text-text-muted hover:text-text disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown className="w-3 h-3 stroke-[2]" />
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-subtle">
            <button
              type="button"
              onClick={() => onChange([...DEFAULT_APPLICATION_COLUMNS])}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:bg-canvas dark:hover:bg-surface-muted hover:text-text transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
              {t('applications.columns.reset')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
