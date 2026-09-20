export type Language = 'es' | 'en';

export type TranslationDict = {
  [key: string]: string | TranslationDict;
};

