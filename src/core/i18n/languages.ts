import en from './locales/en.json';
import ka from './locales/ka.json';

/**
 * Every supported language lives here. To add one:
 * 1. copy `locales/en.json` to `locales/<code>.json` and translate it,
 * 2. import it above and add one line to this list.
 * Nothing else in the app needs to change.
 */
export const LANGUAGES = [
  { code: 'ka', label: 'ქართული', resources: ka },
  { code: 'en', label: 'English', resources: en },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: Language = 'ka';
