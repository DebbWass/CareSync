import { supabase } from '../../lib/supabase';
import { normalizeSupabaseError } from './errors';
import type { MedicationEvent } from '../../types';
import { HISTORY_DEFAULT_DAYS, MISSED_GRACE_PERIOD_MINUTES } from '../../constants/config';

/**
 * Returns the most urgent pending or snoozed event for the patient.
 * Includes medication name/dosage/instructions via join.
 * Only returns events within the grace period window (already due or due soon).
 */
export async function getPendingEvent(patientId: string): Promise<MedicationEvent | null> {
  const windowEnd = new Date(Date.now() + MISSED_GRACE_PERIOD_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('medication_events')
    .select('*, medications(name, dosage, instructions)')
    .eq('patient_id', patientId)
    .in('status', ['pending', 'snoozed'])
    .lte('scheduled_time', windowEnd)
    .order('scheduled_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeSupabaseError(error);
  // null here is a legitimate "no dose due right now", not a failure
  return data as MedicationEvent | null;
}

/**
 * Fetch a specific event by ID (used by deep-link push notification handler).
 */
export async function getEventById(eventId: string): Promise<MedicationEvent | null> {
  const { data, error } = await supabase
    .from('medication_events')
    .select('*, medications(name, dosage, instructions)')
    .eq('id', eventId)
    .single();

  if (error) throw normalizeSupabaseError(error);
  return data as MedicationEvent;
}

/**
 * Mark an event as taken. Records the actual taken timestamp.
 * This is the primary patient action — must succeed reliably.
 *
 * `takenTime` lets the offline outbox replay a confirm with the ORIGINAL tap
 * time (not the reconnect time), keeping the audit log honest. The
 * `status <> 'taken'` guard makes replay idempotent: a dose already confirmed
 * (here or on another device) matches zero rows and is left untouched, so a
 * queued confirm can never clobber an existing taken_time.
 */
export async function confirmEvent(eventId: string, takenTime?: string): Promise<void> {
  const { error } = await supabase
    .from('medication_events')
    .update({
      status: 'taken',
      taken_time: takenTime ?? new Date().toISOString(),
    })
    .eq('id', eventId)
    .neq('status', 'taken');

  if (error) throw normalizeSupabaseError(error);
}

/**
 * Snooze an event via the atomic snooze_event RPC (single UPDATE with
 * snooze_count = snooze_count + 1 — two rapid taps can no longer read the
 * same count and lose an increment, which would have delayed the caregiver
 * alert that fires at SNOOZE_LIMIT).
 *
 * Returns the updated row, or null when the event was no longer snoozable
 * (already taken/missed, e.g. confirmed on another device) — a legitimate
 * outcome, not a failure: callers refetch and render the true state.
 */
export async function snoozeEvent(eventId: string): Promise<MedicationEvent | null> {
  const { data, error } = await supabase.rpc('snooze_event', { p_event_id: eventId });

  if (error) throw normalizeSupabaseError(error);
  return data as MedicationEvent | null;
}

/**
 * Fetch the patient's medication event history (non-pending events).
 * Ordered newest first. Default: last 30 days.
 */
export async function getEventHistory(
  patientId: string,
  days = HISTORY_DEFAULT_DAYS
): Promise<MedicationEvent[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('medication_events')
    .select('*, medications(name, dosage, instructions)')
    .eq('patient_id', patientId)
    .in('status', ['taken', 'missed', 'snoozed'])
    .gte('scheduled_time', since)
    .order('scheduled_time', { ascending: false });

  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as MedicationEvent[];
}
