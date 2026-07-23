jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

import i18n, { detectLanguage, FALLBACK_LANGUAGE, syncLanguageWithStore } from '../index';
import { useSettingsStore } from '../../store/settingsStore';

describe('detectLanguage precedence', () => {
  it('explicit user setting wins over device locale', () => {
    expect(detectLanguage('he', 'en')).toBe('he');
    expect(detectLanguage('en', 'he')).toBe('en');
  });

  it('falls back to device locale when no user setting exists', () => {
    expect(detectLanguage(null, 'he')).toBe('he');
    expect(detectLanguage(null, 'en')).toBe('en');
  });

  it('unsupported device locales resolve to the fallback', () => {
    expect(detectLanguage(null, 'fr')).toBe(FALLBACK_LANGUAGE);
    expect(detectLanguage(null, null)).toBe(FALLBACK_LANGUAGE);
    expect(detectLanguage(null, undefined)).toBe(FALLBACK_LANGUAGE);
  });
});

describe('i18n bootstrap', () => {
  it('initializes with English resources and resolves known keys', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('common.signOut')).toBe('Sign out');
    expect(i18n.t('tabs.today')).toBe('Today');
  });

  it('never renders raw null for missing keys (returnNull disabled)', () => {
    expect(i18n.t('nonexistent.key')).not.toBeNull();
  });
});

describe('syncLanguageWithStore reconciles i18n with the persisted setting', () => {
  // Device locale is mocked to 'en' (see top of file).
  afterEach(async () => {
    useSettingsStore.setState({ language: null });
    await i18n.changeLanguage('en');
  });

  it('applies an explicit saved language that differs from the init default', async () => {
    // Simulates rehydration surfacing a previously-saved 'he' after i18n
    // already initialized to the device language ('en') — the launch bug.
    useSettingsStore.setState({ language: 'he' });
    await syncLanguageWithStore();
    expect(i18n.language).toBe('he');
  });

  it('follows the device locale when the saved language is "device" (null)', async () => {
    useSettingsStore.setState({ language: 'he' });
    await i18n.changeLanguage('he');
    useSettingsStore.setState({ language: null });
    await syncLanguageWithStore();
    expect(i18n.language).toBe('en');
  });

  it('is a no-op when i18n already matches the saved language', async () => {
    useSettingsStore.setState({ language: 'en' });
    const result = syncLanguageWithStore();
    expect(result).toBeUndefined();
    expect(i18n.language).toBe('en');
  });
});
