/**
 * Pure scheduling logic — no I/O, fully unit-testable.
 *
 * The core rule: times_of_day values ("08:00") are wall-clock times in the
 * PATIENT'S timezone (users.timezone, IANA name). A dose instant is that
 * wall-clock time on a given patient-local date, converted to UTC. This is
 * what keeps an 08:00 pill at 08:00 through DST transitions — the UTC offset
 * changes, the patient's clock time does not.
 */

import { DateTime } from 'npm:luxon@3';

export interface SchedulingInput {
  frequency_type: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times_of_day: string[]; // ["08:00", "20:00"] — patient-local wall clock
  days_of_week: number[] | null; // 0=Sun … 6=Sat, in the PATIENT'S calendar
  start_date: string; // YYYY-MM-DD (patient-local date)
  end_date: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeOfDay(value: string): boolean {
  return TIME_RE.test(value);
}

/** Is the schedule active on the given patient-local calendar date? */
export function isActiveOnLocalDate(schedule: SchedulingInput, localDate: DateTime): boolean {
  const dateStr = localDate.toISODate()!;
  if (dateStr < schedule.start_date) return false;
  if (schedule.end_date && dateStr > schedule.end_date) return false;

  const { frequency_type, days_of_week } = schedule;
  if (
    frequency_type === 'daily' ||
    frequency_type === 'twice_daily' ||
    frequency_type === 'three_times_daily'
  ) {
    return true;
  }

  // weekly / custom — luxon weekday: 1=Mon…7=Sun; our convention: 0=Sun…6=Sat
  if (days_of_week && days_of_week.length > 0) {
    const dow = localDate.weekday % 7;
    return days_of_week.includes(dow);
  }

  return false;
}

/**
 * All dose instants (UTC) for a schedule within [windowStart, windowEnd),
 * computed in the patient's timezone. Invalid times_of_day entries are
 * skipped (defense in depth — the app validates on input).
 *
 * DST notes (luxon semantics):
 * - Spring-forward gap (e.g. 02:30 on a day where 02:00→03:00): luxon maps
 *   the nonexistent time forward into the valid hour — the dose still exists.
 * - Fall-back overlap: luxon picks the FIRST occurrence — the dose fires once.
 */
export function computeDoseInstants(
  schedule: SchedulingInput,
  timezone: string,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const zone = timezone || 'UTC';
  const results: Date[] = [];

  const startLocal = DateTime.fromJSDate(windowStart, { zone }).startOf('day');
  const endLocal = DateTime.fromJSDate(windowEnd, { zone }).endOf('day');

  for (let day = startLocal; day <= endLocal; day = day.plus({ days: 1 })) {
    if (!isActiveOnLocalDate(schedule, day)) continue;

    for (const timeStr of schedule.times_of_day) {
      if (!isValidTimeOfDay(timeStr)) continue;
      const [hour, minute] = timeStr.split(':').map(Number);
      const instant = day.set({ hour, minute, second: 0, millisecond: 0 }).toUTC();
      const asDate = instant.toJSDate();
      if (asDate >= windowStart && asDate < windowEnd) {
        results.push(asDate);
      }
    }
  }

  return results;
}

/** Alert decision for a medication_events UPDATE (also used by caregiver-alert). */
export function decideAlertType(
  newRecord: { status: string; snooze_count: number },
  oldRecord: { status: string; snooze_count: number },
  snoozeLimit: number
): 'missed' | 'snoozed_limit' | null {
  if (newRecord.status === 'missed' && oldRecord.status !== 'missed') return 'missed';
  if (newRecord.snooze_count >= snoozeLimit && oldRecord.snooze_count < snoozeLimit) {
    return 'snoozed_limit';
  }
  return null;
}
