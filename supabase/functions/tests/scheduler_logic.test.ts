/**
 * medication-scheduler pure-logic tests.
 *
 * The core property under test: times_of_day are wall-clock times in the
 * patient's timezone. 08:00 must stay 08:00 on the patient's clock through
 * DST transitions — the UTC instant shifts, the local time does not.
 *
 * Israel 2026 DST: IST (UTC+2) → IDT (UTC+3) on Mar 27; back on Oct 25.
 */
import { assertEquals } from '@std/assert';
import {
  computeDoseInstants,
  decideAlertType,
  isValidTimeOfDay,
  type SchedulingInput,
} from '../medication-scheduler/logic.ts';

const daily = (times: string[]): SchedulingInput => ({
  frequency_type: 'daily',
  times_of_day: times,
  days_of_week: null,
  start_date: '2026-01-01',
  end_date: null,
});

function utc(iso: string): Date {
  return new Date(iso);
}

Deno.test('winter (IST, UTC+2): 08:00 Jerusalem = 06:00 UTC', () => {
  const instants = computeDoseInstants(
    daily(['08:00']),
    'Asia/Jerusalem',
    utc('2026-01-15T00:00:00Z'),
    utc('2026-01-16T00:00:00Z')
  );
  assertEquals(instants.length, 1);
  assertEquals(instants[0].toISOString(), '2026-01-15T06:00:00.000Z');
});

Deno.test('summer (IDT, UTC+3): 08:00 Jerusalem = 05:00 UTC', () => {
  const instants = computeDoseInstants(
    daily(['08:00']),
    'Asia/Jerusalem',
    utc('2026-07-15T00:00:00Z'),
    utc('2026-07-16T00:00:00Z')
  );
  assertEquals(instants.length, 1);
  assertEquals(instants[0].toISOString(), '2026-07-15T05:00:00.000Z');
});

Deno.test('DST spring-forward week: wall clock stays 08:00, UTC offset shifts', () => {
  // Mar 26 is IST (UTC+2), Mar 28 is IDT (UTC+3)
  const instants = computeDoseInstants(
    daily(['08:00']),
    'Asia/Jerusalem',
    utc('2026-03-26T00:00:00Z'),
    utc('2026-03-29T00:00:00Z')
  );
  assertEquals(
    instants.map((d) => d.toISOString()),
    [
      '2026-03-26T06:00:00.000Z', // 08:00 IST
      '2026-03-27T05:00:00.000Z', // 08:00 IDT (transition day, after 02:00 jump)
      '2026-03-28T05:00:00.000Z', // 08:00 IDT
    ]
  );
});

Deno.test('DST fall-back week: wall clock stays 20:00 through the Oct 25 transition', () => {
  const instants = computeDoseInstants(
    daily(['20:00']),
    'Asia/Jerusalem',
    utc('2026-10-24T00:00:00Z'),
    utc('2026-10-27T00:00:00Z')
  );
  assertEquals(
    instants.map((d) => d.toISOString()),
    [
      '2026-10-24T17:00:00.000Z', // 20:00 IDT
      '2026-10-25T18:00:00.000Z', // 20:00 IST (clocks fell back that morning)
      '2026-10-26T18:00:00.000Z', // 20:00 IST
    ]
  );
});

Deno.test('multiple daily slots all convert per-slot', () => {
  const instants = computeDoseInstants(
    daily(['08:00', '20:00']),
    'Asia/Jerusalem',
    utc('2026-01-15T00:00:00Z'),
    utc('2026-01-16T00:00:00Z')
  );
  assertEquals(
    instants.map((d) => d.toISOString()),
    ['2026-01-15T06:00:00.000Z', '2026-01-15T18:00:00.000Z']
  );
});

Deno.test('weekly schedule fires only on selected patient-local weekdays', () => {
  const schedule: SchedulingInput = {
    frequency_type: 'weekly',
    times_of_day: ['09:00'],
    days_of_week: [0], // Sunday only (0=Sun convention)
    start_date: '2026-01-01',
    end_date: null,
  };
  // 2026-01-11 is a Sunday
  const instants = computeDoseInstants(
    schedule,
    'Asia/Jerusalem',
    utc('2026-01-09T00:00:00Z'), // Friday
    utc('2026-01-13T00:00:00Z') // through Monday
  );
  assertEquals(instants.length, 1);
  assertEquals(instants[0].toISOString(), '2026-01-11T07:00:00.000Z');
});

Deno.test('start/end date bounds are respected (patient-local dates)', () => {
  const schedule: SchedulingInput = {
    ...daily(['08:00']),
    start_date: '2026-01-15',
    end_date: '2026-01-16',
  };
  const instants = computeDoseInstants(
    schedule,
    'Asia/Jerusalem',
    utc('2026-01-13T00:00:00Z'),
    utc('2026-01-19T00:00:00Z')
  );
  assertEquals(
    instants.map((d) => d.toISOString()),
    ['2026-01-15T06:00:00.000Z', '2026-01-16T06:00:00.000Z']
  );
});

Deno.test('instants outside [windowStart, windowEnd) are excluded', () => {
  const instants = computeDoseInstants(
    daily(['08:00']),
    'Asia/Jerusalem',
    utc('2026-01-15T07:00:00Z'), // after 06:00 UTC dose
    utc('2026-01-16T00:00:00Z')
  );
  assertEquals(instants.length, 0);
});

Deno.test('invalid times_of_day entries are skipped, valid ones survive', () => {
  const instants = computeDoseInstants(
    daily(['25:99', 'not-a-time', '08:00']),
    'Asia/Jerusalem',
    utc('2026-01-15T00:00:00Z'),
    utc('2026-01-16T00:00:00Z')
  );
  assertEquals(instants.length, 1);
});

Deno.test('isValidTimeOfDay accepts HH:MM 24h and rejects garbage', () => {
  assertEquals(isValidTimeOfDay('08:00'), true);
  assertEquals(isValidTimeOfDay('23:59'), true);
  assertEquals(isValidTimeOfDay('24:00'), false);
  assertEquals(isValidTimeOfDay('8:00'), false);
  assertEquals(isValidTimeOfDay('08:60'), false);
});

// ── decideAlertType matrix ────────────────────────────────────────────────────

Deno.test('alert fires when an event transitions to missed', () => {
  assertEquals(
    decideAlertType({ status: 'missed', snooze_count: 0 }, { status: 'pending', snooze_count: 0 }, 3),
    'missed'
  );
});

Deno.test('no alert when the event was already missed (webhook retry)', () => {
  assertEquals(
    decideAlertType({ status: 'missed', snooze_count: 0 }, { status: 'missed', snooze_count: 0 }, 3),
    null
  );
});

Deno.test('alert fires exactly when snooze_count crosses the limit', () => {
  assertEquals(
    decideAlertType({ status: 'snoozed', snooze_count: 3 }, { status: 'snoozed', snooze_count: 2 }, 3),
    'snoozed_limit'
  );
  assertEquals(
    decideAlertType({ status: 'snoozed', snooze_count: 4 }, { status: 'snoozed', snooze_count: 3 }, 3),
    null // already past the limit — alerted last time
  );
  assertEquals(
    decideAlertType({ status: 'snoozed', snooze_count: 2 }, { status: 'snoozed', snooze_count: 1 }, 3),
    null
  );
});

Deno.test('confirming a dose never alerts', () => {
  assertEquals(
    decideAlertType({ status: 'taken', snooze_count: 1 }, { status: 'pending', snooze_count: 1 }, 3),
    null
  );
});
