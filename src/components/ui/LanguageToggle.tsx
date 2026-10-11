'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';

function SpainFlag({ active = true, className = 'h-3.5 w-3.5' }: { active?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(30,27,75,0.12)] transition-opacity duration-200 ${
        active ? 'opacity-100' : 'opacity-50 group-hover/btn:opacity-80'
      }`}
      aria-hidden="true"
    >
      <rect width="24" height="24" fill="#c60b1e" />
      <rect y="6" width="24" height="12" fill="#ffc400" />
      <rect x="6" y="9" width="3" height="5" rx="0.8" fill="#c60b1e" />
      <rect x="6.75" y="9.75" width="1.5" height="3.5" rx="0.4" fill="#ffd966" />
    </svg>
  );
}

function UnitedKingdomFlag({ active = true, className = 'h-3.5 w-3.5' }: { active?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(30,27,75,0.12)] transition-opacity duration-200 ${
        active ? 'opacity-100' : 'opacity-50 group-hover/btn:opacity-80'
      }`}
      aria-hidden="true"
    >
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#fff" strokeWidth="5" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#c8102e" strokeWidth="2.8" />
      <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="8" />
      <path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="4.6" />
    </svg>
  );
}

interface LanguageToggleProps {
  compact?: boolean;
}

export default function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === 'es';

  if (compact) {
    const toggleLabel = isSpanish
      ? 'Cambiar idioma a Inglés'
      : 'Switch language to Spanish';

    return (
      <button
        type="button"
        onClick={() => setLanguage(isSpanish ? 'en' : 'es')}
        className="p-2 rounded-[8px] bg-surface border border-subtle text-text-muted dark:text-slate-300 hover:text-text dark:hover:text-white transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        {isSpanish ? (
          <SpainFlag className="h-4 w-4" active={true} />
        ) : (
          <UnitedKingdomFlag className="h-4 w-4" active={true} />
        )}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={isSpanish ? 'Seleccionar idioma' : 'Select language'}
      className="group relative flex h-9 w-[116px] items-center rounded-[8px] border border-subtle bg-surface p-1 select-none"
      title={isSpanish ? 'Idioma: Español (clic para cambiar a Inglés)' : 'Language: English (click to switch to Spanish)'}
    >
      {/* Indicador deslizante de selección activa */}
      <div
        className={`segmented-indicator absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-[6px] transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isSpanish ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={`group/btn relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-[6px] font-sans text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          isSpanish
            ? 'font-bold text-text'
            : 'font-medium text-text-muted hover:text-text'
        }`}
        aria-label="Español"
        aria-pressed={isSpanish}
      >
        <SpainFlag active={isSpanish} />
        <span>ES</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`group/btn relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-[6px] font-sans text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
          !isSpanish
            ? 'font-bold text-text'
            : 'font-medium text-text-muted hover:text-text'
        }`}
        aria-label="English"
        aria-pressed={!isSpanish}
      >
        <UnitedKingdomFlag active={!isSpanish} />
        <span>EN</span>
      </button>
    </div>
  );
}
