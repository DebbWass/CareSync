/**
 * i18n bootstrap. Import this module ONCE from the root layout — initializing
 * it as a side effect makes `useTranslation()` work everywhere below.
 *
 * Language resolution order:
 *   1. Explicit user choice persisted in settingsStore (set by the language
 *      switcher in Settings)
 *   2. Device locale (expo-localization)
 *   3. English fallback
 *
 * RTL note: the language SWITCHER (not this module) handles I18nManager
 * direction changes — flipping direction needs a native restart, so it is a
 * deliberate user-confirmed action, never an init side effect.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { useSettingsStore, type AppLanguage } from '../store/settingsStore';
import en from './locales/en.json';
import he from './locales/he.json';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['he', 'en'];
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

/** Whether a language renders right-to-left (drives I18nManager + restart). */
export function isRTLLanguage(language: string): boolean {
  return language === 'he';
}

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

/** Resolve the language to display from the current store + device state. */
export function resolveEffectiveLanguage(): AppLanguage {
  return detectLanguage(useSettingsStore.getState().language, getLocales()[0]?.languageCode);
}

const initialLanguage = resolveEffectiveLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: initialLanguage,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: {
    // React already escapes rendered strings
    escapeValue: false,
  },
  returnNull: false,
});

/**
 * Reconcile i18n with the persisted setting.
 *
 * settingsStore persists to AsyncStorage, which rehydrates ASYNCHRONOUSLY —
 * after this module has already run `init` above. So the very first `init`
 * only ever sees the store's in-memory default (language = null → device
 * locale), never the value the user saved on a previous launch. Without this
 * reconciliation the app renders in the device language while the Settings
 * panel (which reads the rehydrated store) shows the saved language checked —
 * the exact mismatch users hit on launch. Re-resolving once the persisted
 * value is available brings the two back in sync.
 */
export function syncLanguageWithStore(): Promise<unknown> | void {
  const effective = resolveEffectiveLanguage();
  if (i18n.language !== effective) {
    return i18n.changeLanguage(effective);
  }
}

if (useSettingsStore.persist.hasHydrated()) {
  // Rehydration already finished (e.g. hot reload) — reconcile immediately.
  syncLanguageWithStore();
} else {
  // First launch: reconcile as soon as AsyncStorage finishes rehydrating.
  useSettingsStore.persist.onFinishHydration(syncLanguageWithStore);
}

export default i18n;
