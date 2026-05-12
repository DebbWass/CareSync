import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAlerts,
  getUnreadAlertCount,
  markAlertRead,
  markAllAlertsRead,
} from '../services/supabase/alerts';
import { useAuthStore } from '../store/authStore';

export const alertKeys = {
  count: (caregiverId: string) => ['alerts', 'count', caregiverId] as const,
  list: (caregiverId: string) => ['alerts', 'list', caregiverId] as const,
};

/** Unread alert count — used for dashboard badge. Refreshes every 60s. */
export function useUnreadAlertCount() {
  const caregiverId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: alertKeys.count(caregiverId ?? ''),
    queryFn: () => (caregiverId ? getUnreadAlertCount(caregiverId) : 0),
    enabled: !!caregiverId,
    refetchInterval: 60 * 1000,
  });
}

/** Full alert list for the alerts inbox screen. */
export function useAlerts() {
  const caregiverId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: alertKeys.list(caregiverId ?? ''),
    queryFn: () => (caregiverId ? getAlerts(caregiverId) : []),
    enabled: !!caregiverId,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  const caregiverId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    mutationFn: (alertId: string) => markAlertRead(alertId),
    onSuccess: () => {
      if (caregiverId) {
        qc.invalidateQueries({ queryKey: alertKeys.count(caregiverId) });
        qc.invalidateQueries({ queryKey: alertKeys.list(caregiverId) });
      }
    },
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  const caregiverId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    mutationFn: () => (caregiverId ? markAllAlertsRead(caregiverId) : Promise.resolve()),
    onSuccess: () => {
      if (caregiverId) {
        qc.invalidateQueries({ queryKey: alertKeys.count(caregiverId) });
        qc.invalidateQueries({ queryKey: alertKeys.list(caregiverId) });
      }
    },
  });
}
