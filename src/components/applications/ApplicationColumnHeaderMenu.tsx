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
  Rows3,
} from 'lucide-react';
import {
  APPLICATION_COLUMN_DATE_FILTER_OPERATORS,
  APPLICATION_COLUMN_FILTER_OPERATORS,
  APPLICATION_COLUMN_IDS,
  APPLICATION_COLUMN_WIDTHS,
  isApplicationDateColumn,
  type ApplicationColumnDateFilterOperator,
  type ApplicationColumnFilter,
  type ApplicationColumnFilterOperatorValue,
  type ApplicationColumnId,
  type ApplicationColumnWidth,
  type ApplicationGrouping,
  type ApplicationSortDirection,
  type ApplicationSortKey,
  type ApplicationSortState,
} from '@/lib/application-views';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

const MENU_WIDTH = 232;

const WIDTH_LABEL_KEYS: Record<ApplicationColumnWidth, string> = {
  auto: 'applications.columns.headerMenu.widthAuto',
  sm: 'applications.columns.headerMenu.widthSm',
  md: 'applications.columns.headerMenu.widthMd',
  lg: 'applications.columns.headerMenu.widthLg',
};

const DATE_OPERATOR_LABEL_KEYS: Record<ApplicationColumnDateFilterOperator, string> = {
  today: 'applications.columns.headerMenu.dateToday',
  last3Days: 'applications.columns.headerMenu.dateLast3Days',
  last7Days: 'applications.columns.headerMenu.dateLast7Days',
  customRange: 'applications.columns.headerMenu.dateCustomRange',
};

const DATE_PRESET_OPERATORS = APPLICATION_COLUMN_DATE_FILTER_OPERATORS.filter(
  (operator): operator is Exclude<ApplicationColumnDateFilterOperator, 'customRange'> => operator !== 'customRange',
);

type Panel = 'root' | 'group' | 'filter' | 'width';

interface ApplicationColumnHeaderMenuProps {
  column: ApplicationColumnId;
  label: string;
  sortable: boolean;
  sort: ApplicationSortState;
  grouping: ApplicationGrouping | null;
  columnFilter?: ApplicationColumnFilter;
  width: ApplicationColumnWidth;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSetSort: (key: ApplicationSortKey, direction: ApplicationSortDirection) => void;
  onSetGrouping: (grouping: ApplicationGrouping | null) => void;
  onSetColumnFilter: (filter: ApplicationColumnFilter | null) => void;
  onSetWidth: (width: ApplicationColumnWidth) => void;
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
        aria-label={t('applications.columns.headerMenu.back')}
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

export default function ApplicationColumnHeaderMenu({
  column,
  label,
  sortable,
  sort,
  grouping,
  columnFilter,
  width,
  canMoveLeft,
  canMoveRight,
  onSetSort,
  onSetGrouping,
  onSetColumnFilter,
  onSetWidth,
  onMove,
}: ApplicationColumnHeaderMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('root');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [draftOperator, setDraftOperator] = useState<ApplicationColumnFilterOperatorValue>('contains');
  const [draftValue, setDraftValue] = useState('');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  const isDateColumn = isApplicationDateColumn(column);
  const isSorted = sort.key === column;
  const isGrouped = grouping?.column === column;
  const hasFilter = Boolean(columnFilter);

  const computePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
    const estimatedHeight = panel === 'group' ? 400 : 340;
    const top = Math.min(
      rect.bottom + 4,
      Math.max(8, window.innerHeight - estimatedHeight - 8),
    );
    setPosition({ top, left });
  }, [panel]);

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

  const openMenu = () => {
    setPanel('root');
    setOpen(true);
  };

  const openFilterPanel = () => {
    setDraftOperator(columnFilter?.operator ?? (isDateColumn ? 'today' : 'contains'));
    setDraftValue(columnFilter?.value ?? '');
    setDraftStartDate(columnFilter?.startDate ?? '');
    setDraftEndDate(columnFilter?.endDate ?? '');
    setPanel('filter');
  };

  const applyFilter = () => {
    if (isDateColumn) {
      if (draftOperator !== 'customRange') {
        onSetColumnFilter({ column, operator: draftOperator, value: '' });
        close(true);
        return;
      }
      if (!draftStartDate && !draftEndDate) return;
      onSetColumnFilter({
        column,
        operator: 'customRange',
        value: '',
        ...(draftStartDate ? { startDate: draftStartDate } : {}),
        ...(draftEndDate ? { endDate: draftEndDate } : {}),
      });
      close(true);
      return;
    }

    const needsValue = draftOperator !== 'isEmpty' && draftOperator !== 'isNotEmpty';
    if (needsValue && !draftValue.trim()) return;
    onSetColumnFilter({
      column,
      operator: draftOperator,
      value: needsValue ? draftValue.trim() : '',
    });
    close(true);
  };

  const menuItemClass = (active = false) => cn(active && 'text-text');

  const renderPanel = () => {
    if (panel === 'group') {
      return (
        <div>
          <PanelHeader
            title={t('applications.columns.headerMenu.groupBy')}
            onBack={() => setPanel('root')}
          />
          <div className="max-h-60 overflow-y-auto scrollbar-custom space-y-0.5">
            {APPLICATION_COLUMN_IDS.map((option) => (
              <MenuItem
                key={option}
                label={t(`applications.columns.labels.${option}`)}
                active={grouping?.column === option}
                onClick={() => {
                  if (grouping?.column === option) onSetGrouping(null);
                  else onSetGrouping({ column: option, direction: 'asc' });
                }}
              />
            ))}
          </div>
          {grouping && (
            <div className="mt-1.5 pt-1.5 border-t border-subtle space-y-1.5">
              <div className="flex items-center gap-1 px-1.5">
                {(['asc', 'desc'] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    aria-pressed={grouping.direction === direction}
                    onClick={() => onSetGrouping({ column: grouping.column, direction })}
                    className={cn(
                      'flex-1 px-2 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-colors',
                      grouping.direction === direction
                        ? 'bg-text dark:bg-white text-canvas'
                        : 'text-text-muted hover:text-text hover:bg-canvas dark:hover:bg-surface-muted',
                    )}
                  >
                    {t(direction === 'asc'
                      ? 'applications.columns.headerMenu.groupAsc'
                      : 'applications.columns.headerMenu.groupDesc')}
                  </button>
                ))}
              </div>
              <MenuItem
                label={t('applications.columns.headerMenu.ungroup')}
                onClick={() => onSetGrouping(null)}
              />
            </div>
          )}
        </div>
      );
    }

    if (panel === 'filter') {
      if (isDateColumn) {
        return (
          <div>
            <PanelHeader
              title={t('applications.columns.headerMenu.filterBy')}
              onBack={() => setPanel('root')}
            />
            <div className="space-y-0.5">
              {DATE_PRESET_OPERATORS.map((operator) => (
                <MenuItem
                  key={operator}
                  label={t(DATE_OPERATOR_LABEL_KEYS[operator])}
                  active={columnFilter?.operator === operator}
                  onClick={() => {
                    onSetColumnFilter({ column, operator, value: '' });
                    close(true);
                  }}
                />
              ))}
              <MenuItem
                label={t(DATE_OPERATOR_LABEL_KEYS.customRange)}
                active={draftOperator === 'customRange'}
                onClick={() => setDraftOperator('customRange')}
              />
            </div>
            {draftOperator === 'customRange' && (
              <div className="px-1.5 pt-2 space-y-2">
                <div className="space-y-1">
                  <label
                    htmlFor={`column-filter-start-${column}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-text-muted"
                  >
                    {t('applications.columns.headerMenu.dateFrom')}
                  </label>
                  <input
                    id={`column-filter-start-${column}`}
                    type="date"
                    value={draftStartDate}
                    onChange={(event) => setDraftStartDate(event.target.value)}
                    className="w-full bg-canvas border border-control rounded-[6px] px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-ai transition-colors font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`column-filter-end-${column}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-text-muted"
                  >
                    {t('applications.columns.headerMenu.dateTo')}
                  </label>
                  <input
                    id={`column-filter-end-${column}`}
                    type="date"
                    value={draftEndDate}
                    onChange={(event) => setDraftEndDate(event.target.value)}
                    className="w-full bg-canvas border border-control rounded-[6px] px-2.5 py-1.5 text-xs text-text focus:outline-none focus:border-ai transition-colors font-sans"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-1.5 pt-2">
              {draftOperator === 'customRange' && (
                <button
                  type="button"
                  onClick={applyFilter}
                  disabled={!draftStartDate && !draftEndDate}
                  className="flex-1 px-3 py-1.5 rounded-[6px] bg-text dark:bg-white text-canvas text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 transition-colors"
                >
                  {t('applications.columns.headerMenu.apply')}
                </button>
              )}
              {columnFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onSetColumnFilter(null);
                    close(true);
                  }}
                  className="px-3 py-1.5 rounded-[6px] border border-subtle text-text-muted hover:text-text text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  {t('applications.columns.headerMenu.removeFilter')}
                </button>
              )}
            </div>
          </div>
        );
      }

      const needsValue = draftOperator !== 'isEmpty' && draftOperator !== 'isNotEmpty';
      return (
        <div>
          <PanelHeader
            title={t('applications.columns.headerMenu.filterBy')}
            onBack={() => setPanel('root')}
          />
          <div className="space-y-0.5">
            {APPLICATION_COLUMN_FILTER_OPERATORS.map((operator) => (
              <MenuItem
                key={operator}
                label={t(`applications.columns.headerMenu.filterOperators.${operator}`)}
                active={draftOperator === operator}
                onClick={() => {
                  setDraftOperator(operator);
                  if (operator !== 'isEmpty' && operator !== 'isNotEmpty') {
                    window.setTimeout(() => filterInputRef.current?.focus(), 0);
                  }
                }}
              />
            ))}
          </div>
          {needsValue && (
            <div className="px-1.5 pt-2">
              <input
                ref={filterInputRef}
                type="text"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyFilter();
                  }
                }}
                placeholder={t('applications.columns.headerMenu.filterPlaceholder')}
                className="w-full bg-canvas border border-control rounded-[6px] px-2.5 py-1.5 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai transition-colors font-sans"
              />
            </div>
          )}
          <div className="flex items-center gap-1.5 px-1.5 pt-2">
            <button
              type="button"
              onClick={applyFilter}
              disabled={needsValue && !draftValue.trim()}
              className="flex-1 px-3 py-1.5 rounded-[6px] bg-text dark:bg-white text-canvas text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 transition-colors"
            >
              {t('applications.columns.headerMenu.apply')}
            </button>
            {columnFilter && (
              <button
                type="button"
                onClick={() => {
                  onSetColumnFilter(null);
                  close(true);
                }}
                className="px-3 py-1.5 rounded-[6px] border border-subtle text-text-muted hover:text-text text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                {t('applications.columns.headerMenu.removeFilter')}
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
            title={t('applications.columns.headerMenu.columnWidth')}
            onBack={() => setPanel('root')}
          />
          <div className="space-y-0.5">
            {APPLICATION_COLUMN_WIDTHS.map((option) => (
              <MenuItem
                key={option}
                label={t(WIDTH_LABEL_KEYS[option])}
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
        {sortable && (
          <>
            <MenuItem
              icon={<ArrowUp className="w-4 h-4 stroke-[1.75]" />}
              label={t('applications.columns.headerMenu.sortAsc')}
              active={isSorted && sort.direction === 'asc'}
              onClick={() => {
                onSetSort(column as ApplicationSortKey, 'asc');
                close(true);
              }}
            />
            <MenuItem
              icon={<ArrowDown className="w-4 h-4 stroke-[1.75]" />}
              label={t('applications.columns.headerMenu.sortDesc')}
              active={isSorted && sort.direction === 'desc'}
              onClick={() => {
                onSetSort(column as ApplicationSortKey, 'desc');
                close(true);
              }}
            />
            <div className="my-1 h-px bg-subtle" />
          </>
        )}
        <MenuItem
          icon={<Rows3 className="w-4 h-4 stroke-[1.75]" />}
          label={t('applications.columns.headerMenu.groupBy')}
          active={isGrouped}
          trailing={<ChevronRight className="w-3.5 h-3.5 text-text-muted stroke-[2]" />}
          onClick={() => setPanel('group')}
        />
        <MenuItem
          icon={<Filter className={cn('w-4 h-4 stroke-[1.75]', hasFilter && 'text-ai')} />}
          label={t('applications.columns.headerMenu.filterBy')}
          active={hasFilter}
          trailing={<ChevronRight className="w-3.5 h-3.5 text-text-muted stroke-[2]" />}
          onClick={openFilterPanel}
        />
        <div className="my-1 h-px bg-subtle" />
        <MenuItem
          icon={<MoveHorizontal className="w-4 h-4 stroke-[1.75]" />}
          label={t('applications.columns.headerMenu.columnWidth')}
          trailing={<ChevronRight className="w-3.5 h-3.5 text-text-muted stroke-[2]" />}
          onClick={() => setPanel('width')}
        />
        <MenuItem
          icon={<ArrowLeft className="w-4 h-4 stroke-[1.75]" />}
          label={t('applications.columns.headerMenu.moveLeft')}
          disabled={!canMoveLeft}
          onClick={() => {
            onMove(-1);
            close(true);
          }}
        />
        <MenuItem
          icon={<ArrowRight className="w-4 h-4 stroke-[1.75]" />}
          label={t('applications.columns.headerMenu.moveRight')}
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
        aria-label={t('applications.columns.headerMenu.menuLabel', { column: label })}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap uppercase tracking-wider transition-colors',
          menuItemClass(isSorted || hasFilter || isGrouped),
        )}
      >
        <span>{label}</span>
        {hasFilter && <Filter className="w-3 h-3 text-ai stroke-[2]" />}
        {isSorted ? (
          sort.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 text-ai stroke-[2]" />
            : <ArrowDown className="w-3 h-3 text-ai stroke-[2]" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-40 stroke-[2]" />
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('applications.columns.headerMenu.menuLabel', { column: label })}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          onKeyDown={(event) => {
            const isInput = (event.target as HTMLElement).tagName === 'INPUT';
            if (event.key === 'ArrowDown' && !isInput) {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === 'ArrowUp' && !isInput) {
              event.preventDefault();
              focusItem(-1);
            } else if (event.key === 'Home' && !isInput) {
              event.preventDefault();
              focusItem('first');
            } else if (event.key === 'End' && !isInput) {
              event.preventDefault();
              focusItem('last');
            } else if (event.key === 'Tab') {
              close();
            }
          }}
          className="fixed z-50 rounded-[10px] border border-subtle bg-surface shadow-dialog p-1.5 font-display"
        >
          {renderPanel()}
        </div>,
        document.body,
      )}
    </>
  );
}
