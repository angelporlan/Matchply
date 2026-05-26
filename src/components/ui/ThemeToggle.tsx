'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
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

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-[8px] bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white transition-all shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center"
      aria-label="Toggle dark mode"
      title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 stroke-[1.75] transition-transform duration-300 rotate-0 hover:rotate-12" />
      ) : (
        <Sun className="w-4 h-4 stroke-[1.75] transition-transform duration-300 rotate-0 hover:rotate-45 text-amber-400" />
      )}
    </button>
  );
}
