/**
 * en/he key-parity test (M6).
 *
 * Every user-facing string must exist in both locales — a missing Hebrew key
 * silently falls back to English, which for an elderly Hebrew-only patient is
 * indistinguishable from a broken app. This test makes the fallback
 * impossible to ship.
 *
 * Plural suffixes are normalized before comparison: English uses _one/_other
 * while Hebrew legitimately adds _two/_many (CLDR plural rules), so parity is
 * checked on the base key, and each base key must have at least the _other
 * form in every locale that pluralizes it.
 */
import en from '../locales/en.json';
import he from '../locales/he.json';

const PLURAL_SUFFIXES = /_(zero|one|two|few|many|other)$/;

/** Flatten nested translation JSON into dot-separated leaf keys. */
function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return leafKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

/** Base keys: plural variants collapse to one logical key. */
function baseKeys(keys: string[]): Set<string> {
  return new Set(keys.map((k) => k.replace(PLURAL_SUFFIXES, '')));
}

const enKeys = leafKeys(en);
const heKeys = leafKeys(he);

describe('en/he key parity', () => {
  it('he.json covers every en.json key', () => {
    const heBase = baseKeys(heKeys);
    const missing = [...baseKeys(enKeys)].filter((k) => !heBase.has(k));
    expect(missing).toEqual([]);
  });

  it('he.json has no keys that en.json lacks (no orphans)', () => {
    const enBase = baseKeys(enKeys);
    const orphans = [...baseKeys(heKeys)].filter((k) => !enBase.has(k));
    expect(orphans).toEqual([]);
  });

  it('every pluralized key has an _other form in both locales', () => {
    for (const keys of [enKeys, heKeys]) {
      const pluralBases = new Set(
        keys.filter((k) => PLURAL_SUFFIXES.test(k)).map((k) => k.replace(PLURAL_SUFFIXES, ''))
      );
      for (const base of pluralBases) {
        expect(keys).toContain(`${base}_other`);
      }
    }
  });

  it('interpolation placeholders match between locales', () => {
    const getValue = (obj: unknown, path: string): string | undefined =>
      path
        .split('.')
        .reduce<unknown>(
          (acc, part) =>
            typeof acc === 'object' && acc !== null
              ? (acc as Record<string, unknown>)[part]
              : undefined,
          obj
        ) as string | undefined;

    const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

    for (const key of enKeys) {
      const enValue = getValue(en, key);
      // Match plural forms loosely: compare against the he variant that exists
      const heKey = heKeys.includes(key) ? key : key.replace(PLURAL_SUFFIXES, '_other');
      const heValue = getValue(he, heKey);
      if (typeof enValue !== 'string' || typeof heValue !== 'string') continue;
      // Hebrew _one/_two forms may legitimately drop {{count}} (spelled out)
      if (PLURAL_SUFFIXES.test(key) && !key.endsWith('_other')) continue;
      expect({ key, placeholders: placeholders(heValue) }).toEqual({
        key,
        placeholders: placeholders(enValue),
      });
    }
  });
});
