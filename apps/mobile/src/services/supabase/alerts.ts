import { supabase } from '../../lib/supabase';
import type { Alert } from '../../types';

/** Count of unread alerts for the caregiver dashboard badge. */
export async function getUnreadAlertCount(caregiverId: string): Promise<number> {
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('caregiver_id', caregiverId)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

/** Full alert list, newest first. */
export async function getAlerts(caregiverId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*, patient:patient_id(name), medication_events(scheduled_time, status)')
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Alerts] getAlerts error:', error.message);
    return [];
  }
  return (data ?? []) as Alert[];
}

/** Mark a single alert as read. */
export async function markAlertRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', alertId);

  if (error) throw error;
}

/** Mark all of a caregiver's alerts as read. */
export async function markAllAlertsRead(caregiverId: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('caregiver_id', caregiverId)
    .eq('is_read', false);

  if (error) throw error;
}
