import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useSettings } from '@/core/settings/store';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';

const known = new Set<string>(LANGUAGES.map((l) => l.code));

function startLanguage(): string {
  const saved = useSettings.getState().language;
  return known.has(saved) ? saved : DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(LANGUAGES.map((l) => [l.code, { translation: l.resources }])),
  lng: startLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

document.documentElement.lang = i18n.language;

useSettings.subscribe((state) => {
  if (state.language !== i18n.language) void i18n.changeLanguage(state.language);
  document.documentElement.lang = state.language;
});

export default i18n;
