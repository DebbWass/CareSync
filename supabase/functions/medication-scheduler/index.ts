/**
 * medication-scheduler — Cron Edge Function (every 5 minutes via pg_cron)
 *
 * 1. For every active schedule, compute dose instants for the next 24 hours
 *    IN THE PATIENT'S TIMEZONE and upsert medication_events (idempotent via
 *    UNIQUE(schedule_id, scheduled_time) + ON CONFLICT DO NOTHING).
 * 2. Mark overdue pending/snoozed events as 'missed' (past the grace period).
 * 3. Send ONE push per imminent event (notified_at guards against the
 *    duplicate-push-per-cron-run bug), localized to the patient's language.
 *
 * PHI rule: push payloads contain ONLY the event_id UUID — no medication
 * names, dosages, or patient names (requirement NF-08).
 *
 * Response: { processed, new_events, notifications_sent, marked_missed }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeDoseInstants, type SchedulingInput } from './logic.ts';
import { notificationCopy } from '../_shared/localization.ts';

const LOOKAHEAD_HOURS = 24;
const PUSH_WINDOW_MINUTES = 10;
// Matches MISSED_DOSE_GRACE_PERIOD_MIN in apps/mobile/src/constants/config.ts
const GRACE_PERIOD_MINUTES = 30;

interface ScheduleRow extends SchedulingInput {
  id: string;
  medication_id: string;
  medications: {
    patient_id: string;
    is_active: boolean;
  };
}

Deno.serve(async (req) => {
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

  const result = { processed: 0, new_events: 0, notifications_sent: 0, marked_missed: 0 };

  // ── Step 1: Load active schedules (with patient) ────────────────────────────

  const { data: schedules, error: schedError } = await supabase
    .from('medication_schedules')
    .select(
      `
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
    `
    )
    .eq('is_active', true)
    .eq('medications.is_active', true)
    .or(`end_date.is.null,end_date.gte.${now.toISOString().slice(0, 10)}`);

  if (schedError) {
    console.error('[scheduler] Failed to load schedules:', schedError.message);
    return new Response(JSON.stringify({ error: schedError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  result.processed = schedules?.length ?? 0;

  if (schedules && schedules.length > 0) {
    // ── Step 2: Load timezone/language for every involved patient (one query) ─

    const typedSchedules = schedules as unknown as ScheduleRow[];
    const patientIds = [...new Set(typedSchedules.map((s) => s.medications.patient_id))];

    const { data: patients, error: patientsError } = await supabase
      .from('users')
      .select('id, timezone, language')
      .in('id', patientIds);

    if (patientsError) {
      console.error('[scheduler] Failed to load patients:', patientsError.message);
      return new Response(JSON.stringify({ error: patientsError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

    // ── Step 3: Upsert dose events, timezone-correct ──────────────────────────

    for (const schedule of typedSchedules) {
      const patient = patientById.get(schedule.medications.patient_id);
      const timezone = patient?.timezone ?? 'UTC';

      const instants = computeDoseInstants(schedule, timezone, now, windowEnd);
      if (instants.length === 0) continue;

      const rows = instants.map((instant) => ({
        schedule_id: schedule.id,
        medication_id: schedule.medication_id,
        patient_id: schedule.medications.patient_id,
        scheduled_time: instant.toISOString(),
        status: 'pending',
        snooze_count: 0,
      }));

      // .select() returns only the rows actually inserted, so new_events is
      // the true count (conflict-skipped duplicates are excluded).
      const { data: inserted, error: upsertError } = await supabase
        .from('medication_events')
        .upsert(rows, { onConflict: 'schedule_id,scheduled_time', ignoreDuplicates: true })
        .select('id');

      if (upsertError) {
        console.error('[scheduler] Upsert error for schedule', schedule.id, upsertError.message);
      } else {
        result.new_events += inserted?.length ?? 0;
      }
    }
  }

  // ── Step 4: Mark overdue events as missed ───────────────────────────────────

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

  // ── Step 5: One push per imminent, not-yet-notified event ───────────────────

  const { data: upcomingEvents, error: upcomingError } = await supabase
    .from('medication_events')
    .select('id, patient_id')
    .eq('status', 'pending')
    .is('notified_at', null)
    .lte('scheduled_time', pushCutoff.toISOString())
    .gte('scheduled_time', graceCutoff.toISOString());

  if (upcomingError) {
    console.error('[scheduler] Failed to load upcoming events:', upcomingError.message);
  } else if (upcomingEvents && upcomingEvents.length > 0) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Languages for the recipients of this batch
    const recipientIds = [...new Set(upcomingEvents.map((e) => e.patient_id))];
    const { data: recipients } = await supabase
      .from('users')
      .select('id, language')
      .in('id', recipientIds);
    const languageById = new Map((recipients ?? []).map((u) => [u.id, u.language]));

    for (const event of upcomingEvents) {
      const copy = notificationCopy('reminder', languageById.get(event.patient_id));
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: event.patient_id,
            title: copy.title,
            body: copy.body,
            // data.type MUST be 'reminder' — the app's notification-tap
            // handler routes on it (src/types/notifications.ts)
            data: { type: 'reminder', event_id: event.id },
            channel: 'medications',
          }),
        });

        if (!res.ok) {
          console.error('[scheduler] send-push failed for event', event.id, res.status);
          continue; // notified_at stays null → retried next cron run
        }

        // Mark as notified so the next cron run never re-sends this dose
        const { error: markError } = await supabase
          .from('medication_events')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', event.id);

        if (markError) {
          console.error('[scheduler] Failed to mark notified:', event.id, markError.message);
        }
        result.notifications_sent++;
      } catch (err) {
        console.error('[scheduler] send-push error for event', event.id, err);
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
