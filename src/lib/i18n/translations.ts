import es from './es';
import en from './en';

export type { Language } from './types';
export type { TranslationTree as TranslationKeys } from './es';

export const translations = { es, en } as const;
