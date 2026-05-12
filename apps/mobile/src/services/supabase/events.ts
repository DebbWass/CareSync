import { supabase } from '../../lib/supabase';
import type { MedicationEvent } from '../../types';
import { HISTORY_DEFAULT_DAYS, MISSED_GRACE_PERIOD_MINUTES } from '../../constants/config';

/**
 * Returns the most urgent pending or snoozed event for the patient.
 * Includes medication name/dosage/instructions via join.
 * Only returns events within the grace period window (already due or due soon).
 */
export async function getPendingEvent(patientId: string): Promise<MedicationEvent | null> {
  const windowEnd = new Date(
    Date.now() + MISSED_GRACE_PERIOD_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('medication_events')
    .select('*, medications(name, dosage, instructions)')
    .eq('patient_id', patientId)
    .in('status', ['pending', 'snoozed'])
    .lte('scheduled_time', windowEnd)
    .order('scheduled_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[Events] getPendingEvent error:', error.message);
    return null;
  }
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

  if (error) {
    console.warn('[Events] getEventById error:', error.message);
    return null;
  }
  return data as MedicationEvent;
}

/**
 * Mark an event as taken. Records the actual taken timestamp.
 * This is the primary patient action — must succeed reliably.
 */
export async function confirmEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('medication_events')
    .update({
      status: 'taken',
      taken_time: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) throw error;
}

/**
 * Snooze an event: increment snooze_count and set status to 'snoozed'.
 * The Edge Function (caregiver-alert) will fire when snooze_count >= SNOOZE_LIMIT.
 */
export async function snoozeEvent(eventId: string): Promise<void> {
  // Read current count first to increment atomically
  const { data, error: fetchError } = await supabase
    .from('medication_events')
    .select('snooze_count')
    .eq('id', eventId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('medication_events')
    .update({
      status: 'snoozed',
      snooze_count: (data.snooze_count ?? 0) + 1,
    })
    .eq('id', eventId);

  if (error) throw error;
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

  if (error) {
    console.warn('[Events] getEventHistory error:', error.message);
    return [];
  }
  return (data ?? []) as MedicationEvent[];
}
