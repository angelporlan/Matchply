'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const toggleLabel = theme === 'light'
    ? (isSpanish ? 'Activar modo oscuro' : 'Enable dark mode')
    : (isSpanish ? 'Activar modo claro' : 'Enable light mode');

  useEffect(() => {
    setMounted(true);
    // Sync state with what was set by the blocking inline head script
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Render a visual placeholder of the exact same size to avoid layout shift and hydration mismatches
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-transparent flex items-center justify-center shadow-sm select-none pointer-events-none"
        aria-hidden="true"
      >
        <span className="w-4 h-4 block" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 stroke-[1.75] transition-transform duration-300 rotate-0 hover:rotate-12" />
      ) : (
        <Sun className="w-4 h-4 stroke-[1.75] transition-transform duration-300 rotate-0 hover:rotate-45 text-amber-400" />
      )}
    </button>
  );
}
