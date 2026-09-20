'use client';

import React, { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Language, TranslationDict } from './types';
import en from './en';
import es from './es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries: Record<Language, TranslationDict> = {
  en: en as unknown as TranslationDict,
  es: es as unknown as TranslationDict,
};

function lookup(dictionary: TranslationDict | null | undefined, key: string): string | undefined {
  if (!dictionary) return undefined;
  const keys = key.split('.');
  let value: unknown = dictionary;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return typeof value === 'string' ? value : undefined;
}

export function LanguageProvider({
  children,
  initialLanguage = 'es',
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('lang', lang);
    document.cookie = `lang=${lang}; path=/; max-age=31536000`;
    router.refresh();
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let value = lookup(dictionaries[language], key);
    if (value === undefined && language !== 'es') value = lookup(dictionaries.es, key);
    if (value === undefined) return key;

    let result = value;
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, val]) => {
        result = result.replace(new RegExp(`{${placeholder}}`, 'g'), String(val));
      });
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
