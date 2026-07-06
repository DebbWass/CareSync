jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

import i18n, { detectLanguage, FALLBACK_LANGUAGE } from '../index';

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
