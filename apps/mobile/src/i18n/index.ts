/**
 * i18n bootstrap. Import this module ONCE from the root layout — initializing
 * it as a side effect makes `useTranslation()` work everywhere below.
 *
 * Language resolution order:
 *   1. Explicit user choice persisted in settingsStore (set by the language
 *      switcher — lands in the Hebrew/RTL milestone)
 *   2. Device locale (expo-localization)
 *   3. English fallback
 *
 * Hebrew resources and RTL activation are added in the Hebrew/RTL milestone;
 * until then everything resolves to English.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { useSettingsStore, type AppLanguage } from '../store/settingsStore';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['he', 'en'];
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

/** Resolve the initial language: user setting → device locale → fallback. */
export function detectLanguage(
  persisted: AppLanguage | null,
  deviceLanguageCode: string | null | undefined
): AppLanguage {
  if (persisted && SUPPORTED_LANGUAGES.includes(persisted)) return persisted;
  if (deviceLanguageCode === 'he') return 'he';
  if (deviceLanguageCode === 'en') return 'en';
  return FALLBACK_LANGUAGE;
}

const initialLanguage = detectLanguage(
  useSettingsStore.getState().language,
  getLocales()[0]?.languageCode
);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    // he: added in the Hebrew/RTL milestone — until then Hebrew falls back to en
  },
  lng: initialLanguage,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: {
    // React already escapes rendered strings
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
