import { useQuery } from '@tanstack/react-query';
import { getAdherenceStats } from '../services/supabase/analytics';
import { ADHERENCE_WINDOW_DAYS } from '../constants/config';

export const adherenceKeys = {
  stats: (patientId: string, days: number) => ['adherence', patientId, days] as const,
};

/**
 * Per-day adherence for one patient over the last `days` local days. Enabled
 * only once a patientId is known. The dashboard card and the per-patient trends
 * screen both read through here, so a caregiver's confirm on one screen and the
 * number on another stay consistent through the shared query cache.
 */
export function useAdherence(patientId: string | undefined, days = ADHERENCE_WINDOW_DAYS) {
  return useQuery({
    queryKey: adherenceKeys.stats(patientId ?? '', days),
    queryFn: () => (patientId ? getAdherenceStats(patientId, days) : []),
    enabled: !!patientId,
  });
}
