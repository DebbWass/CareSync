import { supabase } from '../../lib/supabase';
import { normalizeSupabaseError } from './errors';
import type { Alert } from '../../types';

/** Count of unread alerts for the caregiver dashboard badge. */
export async function getUnreadAlertCount(caregiverId: string): Promise<number> {
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('caregiver_id', caregiverId)
    .eq('is_read', false);

  if (error) throw normalizeSupabaseError(error);
  return count ?? 0;
}

/** Full alert list, newest first. */
export async function getAlerts(caregiverId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*, patient:users!patient_id(name), medication_events(scheduled_time, status)')
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as Alert[];
}

/** Mark a single alert as read. */
export async function markAlertRead(alertId: string): Promise<void> {
  const { error } = await supabase.from('alerts').update({ is_read: true }).eq('id', alertId);

  if (error) throw normalizeSupabaseError(error);
}

/** Mark all of a caregiver's alerts as read. */
export async function markAllAlertsRead(caregiverId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('caregiver_id', caregiverId)
    .eq('is_read', false);

  if (error) throw normalizeSupabaseError(error);
}
