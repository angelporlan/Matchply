"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoveHorizontal,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export type CompanyColumnId =
  | 'name'
  | 'location'
  | 'sector'
  | 'website'
  | 'applicationCount'
  | 'noteCount'
  | 'updatedAt';

export type CompanySortKey = CompanyColumnId;
export type CompanySortDirection = 'asc' | 'desc';
export type CompanySortState = { key: CompanySortKey; direction: CompanySortDirection };
export type CompanyColumnWidth = 'auto' | 'sm' | 'md' | 'lg';
export type CompanyColumnWidths = Partial<Record<CompanyColumnId | 'actions', CompanyColumnWidth>>;

export type CompanyColumnFilter = {
  column: CompanyColumnId;
  operator: 'contains' | 'equals';
  value: string;
};

export const COMPANY_COLUMN_WIDTHS: CompanyColumnWidth[] = ['auto', 'sm', 'md', 'lg'];

export const COMPANY_COLUMN_WIDTH_PX: Record<CompanyColumnWidth, number | undefined> = {
  auto: undefined,
  sm: 120,
  md: 160,
  lg: 220,
};

const MENU_WIDTH = 232;

type Panel = 'root' | 'filter' | 'width';

interface CompanyColumnHeaderMenuProps {
  column: CompanyColumnId | 'actions';
  label: string;
  sortable: boolean;
  filterable?: boolean;
  sort: CompanySortState;
  columnFilter?: CompanyColumnFilter;
  width: CompanyColumnWidth;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSetSort: (key: CompanySortKey, direction: CompanySortDirection) => void;
  onSetColumnFilter: (filter: CompanyColumnFilter | null) => void;
  onSetWidth: (width: CompanyColumnWidth) => void;
  onMove: (direction: -1 | 1) => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  trailing,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left text-xs font-semibold transition-colors',
        disabled
          ? 'opacity-40 cursor-not-allowed text-text-muted'
          : 'text-text hover:bg-canvas dark:hover:bg-surface-muted',
      )}
    >
      {icon && (
        <span className="w-4 h-4 shrink-0 flex items-center justify-center text-text-muted">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {active && !trailing && <Check className="w-3.5 h-3.5 text-ai stroke-[2.5]" />}
      {trailing}
    </button>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-1.5 px-1.5 pb-1.5 mb-1 border-b border-subtle">
      <button
        type="button"
        role="menuitem"
        onClick={onBack}
        aria-label={t('companies.table.columns.menu.back')}
        className="p-1 rounded-[6px] text-text-muted hover:text-text hover:bg-canvas dark:hover:bg-surface-muted transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5 stroke-[2]" />
      </button>
      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {title}
      </span>
    </div>
  );
}

export default function CompanyColumnHeaderMenu({
  column,
  label,
  sortable,
  filterable = true,
  sort,
  columnFilter,
  width,
  canMoveLeft,
  canMoveRight,
  onSetSort,
  onSetColumnFilter,
  onSetWidth,
  onMove,
}: CompanyColumnHeaderMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('root');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [draftOperator, setDraftOperator] = useState<'contains' | 'equals'>('contains');
  const [draftValue, setDraftValue] = useState('');

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  const isSorted = sort.key === column;
  const hasFilter = Boolean(columnFilter);

  const computePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
    const estimatedHeight = 320;
    const top = Math.min(
      rect.bottom + 4,
      Math.max(8, window.innerHeight - estimatedHeight - 8),
    );
    setPosition({ top, left });
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPanel('root');
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    const handleResize = () => close();

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const timer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, panel, computePosition]);

  const openMenu = () => {
    if (columnFilter) {
      setDraftOperator(columnFilter.operator);
      setDraftValue(columnFilter.value);
    } else {
      setDraftOperator('contains');
      setDraftValue('');
    }
    setPanel('root');
    setOpen(true);
  };

  const applyTextFilter = () => {
    if (column === 'actions') return;
    const trimmed = draftValue.trim();
    if (!trimmed) {
      onSetColumnFilter(null);
    } else {
      onSetColumnFilter({
        column,
        operator: draftOperator,
        value: trimmed,
      });
    }
    close(true);
  };

  const menuItemClass = (highlight: boolean) => (
    highlight
      ? 'text-ai font-bold'
      : 'text-text-muted hover:text-text'
  );

  const renderPanel = () => {
    if (panel === 'filter' && column !== 'actions') {
      return (
        <div className="p-1 space-y-2.5">
          <PanelHeader
            title={t('companies.table.columns.menu.filterBy').replace('{column}', label)}
            onBack={() => setPanel('root')}
          />
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
              {t('companies.table.columns.menu.filter')}
            </label>
            <select
              value={draftOperator}
              onChange={(e) => setDraftOperator(e.target.value as 'contains' | 'equals')}
              className="w-full bg-canvas border border-control rounded-[6px] px-2 py-1.5 text-xs text-text focus:outline-none focus:border-ai font-sans"
            >
              <option value="contains">{t('companies.table.columns.menu.filterContains')}</option>
              <option value="equals">{t('companies.table.columns.menu.filterEquals')}</option>
            </select>
            <input
              ref={filterInputRef}
              type="text"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyTextFilter();
                }
              }}
              placeholder={t('companies.table.columns.menu.filterPlaceholder')}
              className="w-full bg-canvas border border-control rounded-[6px] px-2 py-1.5 text-xs text-text focus:outline-none focus:border-ai font-sans"
            />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={applyTextFilter}
              className="flex-1 px-3 py-1.5 rounded-[6px] bg-ai text-white text-xs font-bold font-display shadow-xs hover:opacity-90 transition-opacity"
            >
              {t('companies.table.columns.menu.applyFilter')}
            </button>
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  onSetColumnFilter(null);
                  close(true);
                }}
                className="px-2 py-1.5 rounded-[6px] border border-subtle text-text-muted hover:text-text text-xs transition-colors"
              >
                {t('companies.table.columns.menu.removeFilter')}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (panel === 'width') {
      return (
        <div>
          <PanelHeader
            title={t('companies.table.columns.menu.columnWidth')}
            onBack={() => setPanel('root')}
          />
          <div className="space-y-0.5">
            {COMPANY_COLUMN_WIDTHS.map((option) => (
              <MenuItem
                key={option}
                label={t(`companies.table.columns.menu.width${option.charAt(0).toUpperCase() + option.slice(1)}`)}
                active={width === option}
                onClick={() => {
                  onSetWidth(option);
                  close(true);
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div>
        {sortable && column !== 'actions' && (
          <>
            <MenuItem
              icon={<ArrowUp className="w-4 h-4 stroke-[1.75]" />}
              label={t('companies.table.columns.menu.sortAsc')}
              active={isSorted && sort.direction === 'asc'}
              onClick={() => {
                onSetSort(column as CompanySortKey, 'asc');
                close(true);
              }}
            />
            <MenuItem
              icon={<ArrowDown className="w-4 h-4 stroke-[1.75]" />}
              label={t('companies.table.columns.menu.sortDesc')}
              active={isSorted && sort.direction === 'desc'}
              onClick={() => {
                onSetSort(column as CompanySortKey, 'desc');
                close(true);
              }}
            />
          </>
        )}

        {filterable && column !== 'actions' && (
          <MenuItem
            icon={<Filter className="w-4 h-4 stroke-[1.75]" />}
            label={t('companies.table.columns.menu.filter')}
            active={hasFilter}
            trailing={<ChevronRight className="w-3.5 h-3.5 text-text-muted stroke-[2]" />}
            onClick={() => setPanel('filter')}
          />
        )}

        {(sortable || filterable) && column !== 'actions' && <div className="my-1 h-px bg-subtle" />}

        <MenuItem
          icon={<MoveHorizontal className="w-4 h-4 stroke-[1.75]" />}
          label={t('companies.table.columns.menu.columnWidth')}
          trailing={<ChevronRight className="w-3.5 h-3.5 text-text-muted stroke-[2]" />}
          onClick={() => setPanel('width')}
        />
        <MenuItem
          icon={<ArrowLeft className="w-4 h-4 stroke-[1.75]" />}
          label={t('companies.table.columns.menu.moveLeft')}
          disabled={!canMoveLeft}
          onClick={() => {
            onMove(-1);
            close(true);
          }}
        />
        <MenuItem
          icon={<ArrowRight className="w-4 h-4 stroke-[1.75]" />}
          label={t('companies.table.columns.menu.moveRight')}
          disabled={!canMoveRight}
          onClick={() => {
            onMove(1);
            close(true);
          }}
        />
      </div>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('companies.table.columns.menu.menuLabel').replace('{column}', label)}
        onClick={() => (open ? close() : openMenu())}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap uppercase tracking-wider transition-colors cursor-pointer',
          menuItemClass(isSorted || hasFilter),
        )}
      >
        <span>{label}</span>
        {hasFilter && <Filter className="w-3 h-3 text-ai stroke-[2]" />}
        {isSorted ? (
          sort.direction === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-ai stroke-[2]" />
          ) : (
            <ArrowDown className="w-3 h-3 text-ai stroke-[2]" />
          )
        ) : (
          <ChevronDown className="w-3 h-3 opacity-40 stroke-[2]" />
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('companies.table.columns.menu.menuLabel').replace('{column}', label)}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-50 rounded-[10px] border border-subtle bg-surface shadow-dialog p-1.5 font-display"
        >
          {renderPanel()}
        </div>,
        document.body,
      )}
    </>
  );
}
