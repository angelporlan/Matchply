'use client';

import React, { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Language, TranslationDict } from './types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

async function loadDictionary(lang: Language): Promise<TranslationDict> {
  if (lang === 'en') {
    return (await import('./en')).default as unknown as TranslationDict;
  }
  return (await import('./es')).default as unknown as TranslationDict;
}

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
  initialDictionary,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
  initialDictionary: TranslationDict;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [dictionary, setDictionary] = useState<TranslationDict>(initialDictionary);
  const [fallbackEs, setFallbackEs] = useState<TranslationDict | null>(
    initialLanguage === 'es' ? initialDictionary : null,
  );

  const setLanguage = (lang: Language) => {
    void (async () => {
      const next = await loadDictionary(lang);
      setDictionary(next);
      if (lang === 'es') setFallbackEs(next);
      else if (!fallbackEs) {
        setFallbackEs(await loadDictionary('es'));
      }
      setLanguageState(lang);
      localStorage.setItem('lang', lang);
      document.cookie = `lang=${lang}; path=/; max-age=31536000`;
      router.refresh();
    })();
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let value = lookup(dictionary, key);
    if (value === undefined) value = lookup(fallbackEs, key);
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
