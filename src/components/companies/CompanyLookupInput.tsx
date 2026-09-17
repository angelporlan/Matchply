'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CompanyLookupItem } from '@/lib/job-offer-queries';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface CompanyLookupInputProps {
  id?: string;
  name?: string;
  value: string;
  companies: CompanyLookupItem[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}

export default function CompanyLookupInput({
  id,
  name,
  value,
  companies,
  placeholder,
  required,
  disabled,
  className,
  onChange,
}: CompanyLookupInputProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const query = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return companies.slice(0, 8);
    return companies
      .filter((company) => company.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [companies, query]);

  const exactMatch = companies.some((company) => company.name.toLowerCase() === query);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name={name}
        type="text"
        required={required}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        className={cn(
          'w-full bg-canvas border border-control rounded-[8px] px-3.5 py-2.5 pr-9 text-sm text-text placeholder-text-muted focus:outline-none focus:border-ai dark:focus:border-ai transition-all font-sans',
          className,
        )}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted stroke-[1.75]" />

      {open && (matches.length > 0 || (query && !exactMatch)) && (
        <ul
          ref={listRef}
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-[8px] border border-subtle bg-surface shadow-lg py-1"
        >
          {matches.map((company) => (
            <li key={company.id} role="option" aria-selected={company.name === value}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-text hover:bg-canvas dark:hover:bg-surface-muted truncate"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(company.name);
                  setOpen(false);
                }}
              >
                {company.name}
              </button>
            </li>
          ))}
          {query && !exactMatch && (
            <li className="px-3 py-2 text-[11px] text-text-muted border-t border-subtle">
              {t('companies.lookup.createHint', { name: value.trim() })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
