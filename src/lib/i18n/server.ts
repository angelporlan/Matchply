import { cookies } from 'next/headers';
import type { Language } from './types';
import es from './es';
import en from './en';

const dictionaries = { es, en } as const;

export function getServerTranslations() {
  const cookieStore = cookies();
  const cookieLang = cookieStore.get('lang')?.value;
  const language: Language = (cookieLang === 'es' || cookieLang === 'en') ? cookieLang : 'es';
  const dictionary = dictionaries[language];

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = dictionary;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        let fallbackValue: any = es;
        for (const fk of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && fk in fallbackValue) {
            fallbackValue = fallbackValue[fk];
          } else {
            fallbackValue = undefined;
            break;
          }
        }
        if (typeof fallbackValue === 'string') {
          value = fallbackValue;
        } else {
          return key;
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    let result = value;
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, val]) => {
        result = result.replace(new RegExp(`{${placeholder}}`, 'g'), String(val));
      });
    }

    return result;
  };

  return { language, t };
}
