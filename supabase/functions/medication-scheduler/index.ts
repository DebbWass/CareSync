/**
 * medication-scheduler — Cron Edge Function
 *
 * Runs every 5 minutes (configured in supabase/config.toml).
 *
 * Responsibilities:
 * 1. For every active schedule, calculate dose times for the next 24 hours
 *    and UPSERT the corresponding medication_events rows (ON CONFLICT DO NOTHING).
 * 2. Mark overdue pending/snoozed events as 'missed' (past the grace period).
 * 3. Send push notifications to patients for events due within the next 10 minutes.
 *
 * PHI rule: push notification body contains ONLY the event_id UUID — no
 * medication names, dosages, or patient names (per requirement NF-08).
 *
 * Response: { processed, new_events, notifications_sent, marked_missed }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// How far ahead to generate events (hours)
const LOOKAHEAD_HOURS = 24;

// Window to send push notifications (minutes from now)
const PUSH_WINDOW_MINUTES = 10;

// Grace period after scheduled time before marking missed (minutes)
// Matches MISSED_DOSE_GRACE_PERIOD_MIN in src/constants/config.ts
const GRACE_PERIOD_MINUTES = 30;

interface MedicationSchedule {
  id: string;
  medication_id: string;
  frequency_type: 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
  times_of_day: string[]; // ["08:00", "20:00"]
  days_of_week: number[] | null; // 0=Sun … 6=Sat; null for daily/twice/three
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  medications: {
    patient_id: string;
    is_active: boolean;
  };
}

interface SchedulerResult {
  processed: number;
  new_events: number;
  notifications_sent: number;
  marked_missed: number;
}

// Parse "HH:MM" and return [hours, minutes]
function parseTime(t: string): [number, number] {
  const [h, m] = t.split(':').map(Number);
  return [h, m];
}

// Build a UTC Date for a given date string and HH:MM time string
function buildDateTime(dateStr: string, timeStr: string): Date {
  const [h, m] = parseTime(timeStr);
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

// Return YYYY-MM-DD for a given UTC Date
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns true if the schedule is active on the given UTC date
function isActiveOnDate(schedule: MedicationSchedule, date: Date): boolean {
  const dateStr = toDateStr(date);
  if (dateStr < schedule.start_date) return false;
  if (schedule.end_date && dateStr > schedule.end_date) return false;

  const { frequency_type, days_of_week } = schedule;

  if (frequency_type === 'daily' || frequency_type === 'twice_daily' || frequency_type === 'three_times_daily') {
    return true;
  }

  // weekly or custom — check days_of_week
  if (days_of_week && days_of_week.length > 0) {
    const dow = date.getUTCDay(); // 0=Sunday
    return days_of_week.includes(dow);
  }

  return false;
}

// Generate scheduled_time ISO strings for a schedule within [windowStart, windowEnd)
function generateScheduledTimes(
  schedule: MedicationSchedule,
  windowStart: Date,
  windowEnd: Date
): Date[] {
  const results: Date[] = [];

  // Iterate over each day in the window
  const current = new Date(windowStart);
  current.setUTCHours(0, 0, 0, 0);

  while (current < windowEnd) {
    if (isActiveOnDate(schedule, current)) {
      for (const timeStr of schedule.times_of_day) {
        const dt = buildDateTime(toDateStr(current), timeStr);
        if (dt >= windowStart && dt < windowEnd) {
          results.push(dt);
        }
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return results;
}

Deno.serve(async (req) => {
  // Allow manual HTTP trigger (GET or POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);
  const pushCutoff = new Date(now.getTime() + PUSH_WINDOW_MINUTES * 60 * 1000);
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MINUTES * 60 * 1000);

  const result: SchedulerResult = {
    processed: 0,
    new_events: 0,
    notifications_sent: 0,
    marked_missed: 0,
  };

  // ── Step 1: Load all active schedules ──────────────────────────────────────

  const { data: schedules, error: schedError } = await supabase
    .from('medication_schedules')
    .select(`
      id,
      medication_id,
      frequency_type,
      times_of_day,
      days_of_week,
      start_date,
      end_date,
      medications!inner (
        patient_id,
        is_active
      )
    `)
    .eq('medications.is_active', true)
    .lte('start_date', toDateStr(windowEnd))
    .or(`end_date.is.null,end_date.gte.${toDateStr(now)}`);

  if (schedError) {
    console.error('[scheduler] Failed to load schedules:', schedError.message);
    return new Response(JSON.stringify({ error: schedError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!schedules || schedules.length === 0) {
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  result.processed = schedules.length;

  // ── Step 2: Upsert events for each schedule ────────────────────────────────

  for (const rawSchedule of schedules) {
    // Type assertion — Supabase returns the join as a nested object
    const schedule = rawSchedule as unknown as MedicationSchedule;
    const patientId = schedule.medications.patient_id;

    const scheduledTimes = generateScheduledTimes(schedule, now, windowEnd);

    for (const scheduledTime of scheduledTimes) {
      const { error: upsertError } = await supabase
        .from('medication_events')
        .upsert(
          {
            schedule_id: schedule.id,
            medication_id: schedule.medication_id,
            patient_id: patientId,
            scheduled_time: scheduledTime.toISOString(),
            status: 'pending',
            snooze_count: 0,
          },
          {
            onConflict: 'schedule_id,scheduled_time',
            ignoreDuplicates: true,
          }
        );

      if (upsertError) {
        console.error(
          '[scheduler] Upsert error for schedule',
          schedule.id,
          upsertError.message
        );
      } else {
        result.new_events++;
      }
    }
  }

  // ── Step 3: Mark overdue events as missed ──────────────────────────────────

  const { data: missedData, error: missedError } = await supabase
    .from('medication_events')
    .update({ status: 'missed' })
    .in('status', ['pending', 'snoozed'])
    .lt('scheduled_time', graceCutoff.toISOString())
    .select('id');

  if (missedError) {
    console.error('[scheduler] Failed to mark missed events:', missedError.message);
  } else {
    result.marked_missed = missedData?.length ?? 0;
  }

  // ── Step 4: Send push notifications for imminent events ───────────────────

  const { data: upcomingEvents, error: upcomingError } = await supabase
    .from('medication_events')
    .select('id, patient_id, scheduled_time')
    .eq('status', 'pending')
    .gte('scheduled_time', now.toISOString())
    .lte('scheduled_time', pushCutoff.toISOString());

  if (upcomingError) {
    console.error('[scheduler] Failed to load upcoming events:', upcomingError.message);
  } else if (upcomingEvents && upcomingEvents.length > 0) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    for (const event of upcomingEvents) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_id: event.patient_id,
            title: 'Medication Reminder',
            // PHI-safe: body contains NO medication name, dosage, or patient name
            body: "Time to take your medication. Tap to view details.",
            data: {
              type: 'medication_reminder',
              event_id: event.id,
            },
            channel: 'medications',
          }),
        });

        if (!res.ok) {
          console.error('[scheduler] send-push failed for event', event.id, res.status);
        } else {
          result.notifications_sent++;
        }
      } catch (err) {
        console.error('[scheduler] send-push error for event', event.id, err);
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
