import { supabase } from '../../lib/supabase';
import { normalizeSupabaseError } from './errors';
import { ADHERENCE_WINDOW_DAYS } from '../../constants/config';

/**
 * One patient-local day of resolved doses, as returned by the adherence_stats
 * RPC. `bucket_day` is a YYYY-MM-DD string in the patient's own timezone (the
 * RPC does the AT TIME ZONE projection — never re-derive the day client-side).
 * `total_doses` counts taken + missed; `taken_doses` is the numerator.
 */
export interface AdherenceDay {
  bucket_day: string;
  total_doses: number;
  taken_doses: number;
}

/**
 * A rolled-up view of an adherence window. `percent` is intentionally nullable:
 * with no resolved doses there is no honest percentage, so the UI shows "no
 * data" rather than a misleading 0%.
 */
export interface AdherenceSummary {
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  percent: number | null;
}

/**
 * Per-day adherence for a single patient over the last `days` patient-local
 * days. RLS constrains the RPC to patients the caller may see, so a caregiver
 * only ever gets their active patients and an unrelated id returns [].
 */
export async function getAdherenceStats(
  patientId: string,
  days = ADHERENCE_WINDOW_DAYS
): Promise<AdherenceDay[]> {
  const { data, error } = await supabase.rpc('adherence_stats', {
    p_patient_id: patientId,
    p_days: days,
  });

  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as AdherenceDay[];
}

/** Roll per-day rows into a single headline summary (used by the dashboard). */
export function summarizeAdherence(days: AdherenceDay[]): AdherenceSummary {
  const totalDoses = days.reduce((sum, d) => sum + d.total_doses, 0);
  const takenDoses = days.reduce((sum, d) => sum + d.taken_doses, 0);
  return {
    totalDoses,
    takenDoses,
    missedDoses: totalDoses - takenDoses,
    percent: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : null,
  };
}
