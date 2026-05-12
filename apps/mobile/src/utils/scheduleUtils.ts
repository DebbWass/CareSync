import type { FrequencyType } from '../types';

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_times_daily: 'Three times daily',
  weekly: 'Weekly',
  custom: 'Custom',
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Number of time slots required for a given frequency. */
export function timeSlotsForFrequency(freq: FrequencyType): number {
  switch (freq) {
    case 'daily': return 1;
    case 'twice_daily': return 2;
    case 'three_times_daily': return 3;
    case 'weekly':
    case 'custom': return 1; // minimum; user can add more
  }
}

/** Default times of day for a given frequency. */
export function defaultTimesForFrequency(freq: FrequencyType): string[] {
  switch (freq) {
    case 'daily': return ['08:00'];
    case 'twice_daily': return ['08:00', '20:00'];
    case 'three_times_daily': return ['08:00', '14:00', '20:00'];
    case 'weekly':
    case 'custom': return ['08:00'];
  }
}

/** Human-readable summary of times, e.g. "8:00 AM, 8:00 PM" */
export function formatTimes(times: string[]): string {
  return times
    .map((t) => {
      const [h, m] = t.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 === 0 ? 12 : h % 12;
      return `${hour}:${String(m).padStart(2, '0')} ${period}`;
    })
    .join(', ');
}

/** Human-readable days-of-week summary, e.g. "Mon, Wed, Fri" */
export function formatDays(days: number[] | undefined | null): string {
  if (!days || days.length === 0) return 'Every day';
  return days.map((d) => DAY_LABELS[d]).join(', ');
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
