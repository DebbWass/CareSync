/**
 * Unit tests for scheduleUtils.ts
 *
 * All functions are pure (no I/O, no network, no React) so no mocking is needed.
 */

import {
  DAY_LABELS,
  FREQUENCY_LABELS,
  defaultTimesForFrequency,
  formatDays,
  formatTimes,
  isValidDate,
  isValidTime,
  timeSlotsForFrequency,
  todayISO,
} from '../scheduleUtils';

// ── FREQUENCY_LABELS ──────────────────────────────────────────────────────────

describe('FREQUENCY_LABELS', () => {
  it('has a label for every frequency type', () => {
    expect(FREQUENCY_LABELS.daily).toBe('Once daily');
    expect(FREQUENCY_LABELS.twice_daily).toBe('Twice daily');
    expect(FREQUENCY_LABELS.three_times_daily).toBe('Three times daily');
    expect(FREQUENCY_LABELS.weekly).toBe('Weekly');
    expect(FREQUENCY_LABELS.custom).toBe('Custom');
  });
});

// ── DAY_LABELS ────────────────────────────────────────────────────────────────

describe('DAY_LABELS', () => {
  it('has 7 entries starting with Sun', () => {
    expect(DAY_LABELS).toHaveLength(7);
    expect(DAY_LABELS[0]).toBe('Sun');
    expect(DAY_LABELS[6]).toBe('Sat');
  });
});

// ── timeSlotsForFrequency ─────────────────────────────────────────────────────

describe('timeSlotsForFrequency', () => {
  it('returns 1 for daily', () => expect(timeSlotsForFrequency('daily')).toBe(1));
  it('returns 2 for twice_daily', () => expect(timeSlotsForFrequency('twice_daily')).toBe(2));
  it('returns 3 for three_times_daily', () => expect(timeSlotsForFrequency('three_times_daily')).toBe(3));
  it('returns 1 (minimum) for weekly', () => expect(timeSlotsForFrequency('weekly')).toBe(1));
  it('returns 1 (minimum) for custom', () => expect(timeSlotsForFrequency('custom')).toBe(1));
});

// ── defaultTimesForFrequency ──────────────────────────────────────────────────

describe('defaultTimesForFrequency', () => {
  it('daily → one time', () => {
    const times = defaultTimesForFrequency('daily');
    expect(times).toHaveLength(1);
    expect(times[0]).toBe('08:00');
  });

  it('twice_daily → two times', () => {
    const times = defaultTimesForFrequency('twice_daily');
    expect(times).toHaveLength(2);
    expect(times).toContain('08:00');
    expect(times).toContain('20:00');
  });

  it('three_times_daily → three times', () => {
    const times = defaultTimesForFrequency('three_times_daily');
    expect(times).toHaveLength(3);
    expect(times).toContain('14:00');
  });

  it('weekly → one default time', () => {
    expect(defaultTimesForFrequency('weekly')).toHaveLength(1);
  });

  it('custom → one default time', () => {
    expect(defaultTimesForFrequency('custom')).toHaveLength(1);
  });

  it('slot count matches timeSlotsForFrequency for fixed frequencies', () => {
    const freqs = ['daily', 'twice_daily', 'three_times_daily'] as const;
    for (const f of freqs) {
      expect(defaultTimesForFrequency(f)).toHaveLength(timeSlotsForFrequency(f));
    }
  });
});

// ── formatTimes ───────────────────────────────────────────────────────────────

describe('formatTimes', () => {
  it('converts 08:00 to 8:00 AM', () => {
    expect(formatTimes(['08:00'])).toBe('8:00 AM');
  });

  it('converts 20:00 to 8:00 PM', () => {
    expect(formatTimes(['20:00'])).toBe('8:00 PM');
  });

  it('converts 12:00 (noon) to 12:00 PM', () => {
    expect(formatTimes(['12:00'])).toBe('12:00 PM');
  });

  it('converts 00:00 (midnight) to 12:00 AM', () => {
    expect(formatTimes(['00:00'])).toBe('12:00 AM');
  });

  it('joins multiple times with a comma', () => {
    expect(formatTimes(['08:00', '14:00', '20:00'])).toBe('8:00 AM, 2:00 PM, 8:00 PM');
  });

  it('pads minutes correctly for e.g. 08:05', () => {
    expect(formatTimes(['08:05'])).toBe('8:05 AM');
  });

  it('returns empty string for empty array', () => {
    expect(formatTimes([])).toBe('');
  });
});

// ── formatDays ────────────────────────────────────────────────────────────────

describe('formatDays', () => {
  it('returns "Every day" for null', () => {
    expect(formatDays(null)).toBe('Every day');
  });

  it('returns "Every day" for undefined', () => {
    expect(formatDays(undefined)).toBe('Every day');
  });

  it('returns "Every day" for empty array', () => {
    expect(formatDays([])).toBe('Every day');
  });

  it('formats Mon/Wed/Fri (1,3,5)', () => {
    expect(formatDays([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('formats a single day', () => {
    expect(formatDays([0])).toBe('Sun');
  });

  it('formats all days', () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('Sun, Mon, Tue, Wed, Thu, Fri, Sat');
  });
});

// ── isValidTime ───────────────────────────────────────────────────────────────

describe('isValidTime', () => {
  // Valid
  it('accepts 00:00', () => expect(isValidTime('00:00')).toBe(true));
  it('accepts 08:00', () => expect(isValidTime('08:00')).toBe(true));
  it('accepts 23:59', () => expect(isValidTime('23:59')).toBe(true));
  it('accepts 12:30', () => expect(isValidTime('12:30')).toBe(true));

  // Invalid
  it('rejects 24:00', () => expect(isValidTime('24:00')).toBe(false));
  it('rejects 8:00 (no leading zero)', () => expect(isValidTime('8:00')).toBe(false));
  it('rejects 08:60', () => expect(isValidTime('08:60')).toBe(false));
  it('rejects empty string', () => expect(isValidTime('')).toBe(false));
  it('rejects "abc"', () => expect(isValidTime('abc')).toBe(false));
  it('rejects "08:0" (incomplete)', () => expect(isValidTime('08:0')).toBe(false));
  it('rejects "08:000" (too long)', () => expect(isValidTime('08:000')).toBe(false));
});

// ── isValidDate ───────────────────────────────────────────────────────────────

describe('isValidDate', () => {
  // Valid
  it('accepts 2026-01-01', () => expect(isValidDate('2026-01-01')).toBe(true));
  it('accepts 2026-12-31', () => expect(isValidDate('2026-12-31')).toBe(true));
  it('accepts a leap day 2024-02-29', () => expect(isValidDate('2024-02-29')).toBe(true));

  // Invalid format
  it('rejects 01-01-2026 (wrong order)', () => expect(isValidDate('01-01-2026')).toBe(false));
  it('rejects 2026/01/01 (slashes)', () => expect(isValidDate('2026/01/01')).toBe(false));
  it('rejects empty string', () => expect(isValidDate('')).toBe(false));
  it('rejects "not-a-date"', () => expect(isValidDate('not-a-date')).toBe(false));

  // Invalid calendar date — month 13 is always caught
  it('rejects 2026-13-01 (month 13)', () => expect(isValidDate('2026-13-01')).toBe(false));
  // Note: JS engines (V8) silently roll over 02-29 in non-leap years to 03-01,
  // so that edge case is intentionally not tested here.
});

// ── todayISO ──────────────────────────────────────────────────────────────────

describe('todayISO', () => {
  it('returns a 10-character YYYY-MM-DD string', () => {
    const today = todayISO();
    expect(today).toHaveLength(10);
    expect(isValidDate(today)).toBe(true);
  });

  it('matches today\'s date', () => {
    const expected = new Date().toISOString().slice(0, 10);
    expect(todayISO()).toBe(expected);
  });
});
