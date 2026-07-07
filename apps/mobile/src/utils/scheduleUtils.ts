import i18n from '../i18n';
import type { FrequencyType } from '../types';

// Day labels come from i18n (schedules.days.0–6) so Hebrew is translation-only.
// FREQUENCY_LABELS was removed in M6 — screens use t(`schedules.frequency.*`).

/** Localized short day labels, Sunday-first (index matches days_of_week). */
export function dayLabels(): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => i18n.t(`schedules.days.${i}`));
}

/** Number of time slots required for a given frequency. */
export function timeSlotsForFrequency(freq: FrequencyType): number {
  switch (freq) {
    case 'daily':
      return 1;
    case 'twice_daily':
      return 2;
    case 'three_times_daily':
      return 3;
    case 'weekly':
    case 'custom':
      return 1; // minimum; user can add more
  }
}

/** Default times of day for a given frequency. */
export function defaultTimesForFrequency(freq: FrequencyType): string[] {
  switch (freq) {
    case 'daily':
      return ['08:00'];
    case 'twice_daily':
      return ['08:00', '20:00'];
    case 'three_times_daily':
      return ['08:00', '14:00', '20:00'];
    case 'weekly':
    case 'custom':
      return ['08:00'];
  }
}

/**
 * Human-readable summary of times.
 * English: 12-hour with AM/PM ("8:00 AM, 8:00 PM"); Hebrew: 24-hour
 * ("8:00, 20:00") — Israel uses the 24-hour clock.
 */
export function formatTimes(times: string[]): string {
  const use24h = i18n.language === 'he';
  return times
    .map((t) => {
      const [h, m] = t.split(':').map(Number);
      if (use24h) return `${h}:${String(m).padStart(2, '0')}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 === 0 ? 12 : h % 12;
      return `${hour}:${String(m).padStart(2, '0')} ${period}`;
    })
    .join(', ');
}

/** Human-readable days-of-week summary, e.g. "Mon, Wed, Fri" — localized. */
export function formatDays(days: number[] | undefined | null): string {
  if (!days || days.length === 0) return i18n.t('schedules.everyDay');
  const labels = dayLabels();
  return days.map((d) => labels[d]).join(', ');
}

/** Validate that a time string is in HH:MM 24-hour format. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

/** Validate a YYYY-MM-DD date string. */
export function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

/** Today as a YYYY-MM-DD string. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
