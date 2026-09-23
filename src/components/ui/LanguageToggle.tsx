'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';

function SpainFlag() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(30,27,75,0.12)]" aria-hidden="true">
      <rect width="24" height="24" fill="#c60b1e" />
      <rect y="6" width="24" height="12" fill="#ffc400" />
      <rect x="6" y="9" width="3" height="5" rx="0.8" fill="#c60b1e" />
      <rect x="6.75" y="9.75" width="1.5" height="3.5" rx="0.4" fill="#ffd966" />
    </svg>
  );
}

function UnitedKingdomFlag() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(30,27,75,0.12)]" aria-hidden="true">
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#fff" strokeWidth="5" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#c8102e" strokeWidth="2.8" />
      <path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="8" />
      <path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="4.6" />
    </svg>
  );
}

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === 'es';

  return (
    <div
      className="group relative flex h-10 w-[116px] items-center overflow-hidden rounded-[8px] border border-subtle bg-surface p-1"
      title={isSpanish ? 'Cambiar a Inglés' : 'Switch to Spanish'}
    >
      <div
        className={`absolute bottom-1 top-1 w-[52px] rounded-[6px] bg-text/10 transition-all duration-300 ease-out ${
          isSpanish ? 'left-1' : 'left-[60px]'
        }`}
      />

      <button
        onClick={() => setLanguage('es')}
        className={`relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-[6px] font-display text-[10px] font-bold transition-all duration-300 ${
          isSpanish
            ? 'text-text'
            : 'text-text-muted hover:text-text'
        }`}
        aria-label="Español"
        aria-pressed={isSpanish}
      >
        <SpainFlag />
        <span>ES</span>
      </button>

      <button
        onClick={() => setLanguage('en')}
        className={`relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-[6px] font-display text-[10px] font-bold transition-all duration-300 ${
          !isSpanish
            ? 'text-text'
            : 'text-text-muted hover:text-text'
        }`}
        aria-label="English"
        aria-pressed={!isSpanish}
      >
        <UnitedKingdomFlag />
        <span>EN</span>
      </button>
    </div>
  );
}
