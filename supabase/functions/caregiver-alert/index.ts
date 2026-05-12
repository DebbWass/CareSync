/**
 * caregiver-alert — Database Webhook Edge Function
 *
 * Triggered by a Supabase DB webhook on UPDATE to the `medication_events` table.
 *
 * Fires when:
 * - `new.status = 'missed'` (transition from non-missed), OR
 * - `new.snooze_count >= SNOOZE_LIMIT` (3) and `old.snooze_count < SNOOZE_LIMIT`
 *
 * Actions:
 * 1. Look up all active caregivers for the patient
 * 2. Insert one `alerts` row per caregiver (ON CONFLICT DO NOTHING to be idempotent)
 * 3. Send a push notification to each caregiver
 *
 * PHI rule: push body contains no medication names, dosages, or patient names.
 *
 * Request body (Supabase DB webhook format):
 *   { type: "UPDATE", table: "medication_events", record: {...}, old_record: {...} }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Must match src/constants/config.ts SNOOZE_LIMIT
const SNOOZE_LIMIT = 3;

interface MedicationEvent {
  id: string;
  schedule_id: string;
  medication_id: string;
  patient_id: string;
  scheduled_time: string;
  taken_time: string | null;
  status: 'pending' | 'taken' | 'snoozed' | 'missed';
  snooze_count: number;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: MedicationEvent;
  old_record: MedicationEvent | null;
  schema: string;
}

type AlertType = 'missed' | 'snoozed_limit';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only process UPDATE events on medication_events
  if (payload.type !== 'UPDATE' || payload.table !== 'medication_events') {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const newRecord = payload.record;
  const oldRecord = payload.old_record;

  if (!newRecord || !oldRecord) {
    return new Response(JSON.stringify({ skipped: true, reason: 'missing record data' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Determine which alert type to fire (if any)
  let alertType: AlertType | null = null;

  const becameMissed =
    newRecord.status === 'missed' && oldRecord.status !== 'missed';

  const hitSnoozeLimit =
    newRecord.snooze_count >= SNOOZE_LIMIT &&
    oldRecord.snooze_count < SNOOZE_LIMIT;

  if (becameMissed) {
    alertType = 'missed';
  } else if (hitSnoozeLimit) {
    alertType = 'snoozed_limit';
  }

  if (!alertType) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no trigger condition' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ── Step 1: Find all active caregivers for this patient ────────────────────

  const { data: relationships, error: relError } = await supabase
    .from('patient_caregiver_relationships')
    .select('caregiver_id')
    .eq('patient_id', newRecord.patient_id)
    .eq('status', 'active');

  if (relError) {
    console.error('[caregiver-alert] Failed to fetch caregivers:', relError.message);
    return new Response(JSON.stringify({ error: relError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!relationships || relationships.length === 0) {
    // No active caregivers — nothing to do
    return new Response(
      JSON.stringify({ alerts_created: 0, notifications_sent: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Step 2: Insert alert rows (one per caregiver) ──────────────────────────

  const alertRows = relationships.map((rel) => ({
    patient_id: newRecord.patient_id,
    caregiver_id: rel.caregiver_id,
    event_id: newRecord.id,
    alert_type: alertType as AlertType,
    is_read: false,
  }));

  const { error: insertError } = await supabase
    .from('alerts')
    .upsert(alertRows, {
      onConflict: 'caregiver_id,event_id,alert_type',
      ignoreDuplicates: true,
    });

  if (insertError) {
    console.error('[caregiver-alert] Failed to insert alerts:', insertError.message);
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Step 3: Push notification to each caregiver ───────────────────────────

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const alertTitle =
    alertType === 'missed' ? 'Missed Medication' : 'Snooze Limit Reached';

  // PHI-safe: no patient name or medication name in the push body
  const alertBody =
    alertType === 'missed'
      ? 'A patient missed their scheduled medication. Tap to review.'
      : 'A patient has snoozed their medication reminder too many times. Tap to review.';

  let notifications_sent = 0;

  for (const rel of relationships) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_id: rel.caregiver_id,
          title: alertTitle,
          body: alertBody,
          data: {
            type: alertType === 'missed' ? 'missed_dose' : 'snooze_limit',
            event_id: newRecord.id,
            patient_id: newRecord.patient_id,
          },
          channel: 'medications',
        }),
      });

      if (!res.ok) {
        console.error(
          '[caregiver-alert] send-push failed for caregiver',
          rel.caregiver_id,
          res.status
        );
      } else {
        notifications_sent++;
      }
    } catch (err) {
      console.error(
        '[caregiver-alert] send-push error for caregiver',
        rel.caregiver_id,
        err
      );
    }
  }

  return new Response(
    JSON.stringify({
      alerts_created: alertRows.length,
      notifications_sent,
      alert_type: alertType,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
