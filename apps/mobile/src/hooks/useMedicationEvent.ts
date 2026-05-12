import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmEvent,
  getEventById,
  getEventHistory,
  getPendingEvent,
  snoozeEvent,
} from '../services/supabase/events';
import { useAuthStore } from '../store/authStore';

// ── Query keys ────────────────────────────────────────────────────────────────

export const eventKeys = {
  pending: (patientId: string) => ['events', 'pending', patientId] as const,
  byId: (eventId: string) => ['events', 'detail', eventId] as const,
  history: (patientId: string) => ['events', 'history', patientId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Polls for the current pending/snoozed event every 60 seconds. */
export function usePendingEvent() {
  const patientId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: eventKeys.pending(patientId ?? ''),
    queryFn: () => (patientId ? getPendingEvent(patientId) : null),
    enabled: !!patientId,
    refetchInterval: 60 * 1000,   // check for new reminders every minute
    refetchOnWindowFocus: true,
  });
}

/** Fetches a single event by ID — used by the deep-link reminder screen. */
export function useEventById(eventId: string | null) {
  return useQuery({
    queryKey: eventKeys.byId(eventId ?? ''),
    queryFn: () => (eventId ? getEventById(eventId) : null),
    enabled: !!eventId,
  });
}

/** Loads the patient's medication event history. */
export function useEventHistory() {
  const patientId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: eventKeys.history(patientId ?? ''),
    queryFn: () => (patientId ? getEventHistory(patientId) : []),
    enabled: !!patientId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Confirms a medication was taken. Invalidates pending + history caches. */
export function useConfirmEvent() {
  const qc = useQueryClient();
  const patientId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    mutationFn: (eventId: string) => confirmEvent(eventId),
    onSuccess: () => {
      if (patientId) {
        qc.invalidateQueries({ queryKey: eventKeys.pending(patientId) });
        qc.invalidateQueries({ queryKey: eventKeys.history(patientId) });
      }
    },
  });
}

/** Snoozes the current event. Invalidates the pending event cache. */
export function useSnoozeEvent() {
  const qc = useQueryClient();
  const patientId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    mutationFn: (eventId: string) => snoozeEvent(eventId),
    onSuccess: (_data, eventId) => {
      // Optimistically clear the detail cache so the screen refreshes
      qc.invalidateQueries({ queryKey: eventKeys.byId(eventId) });
      if (patientId) {
        qc.invalidateQueries({ queryKey: eventKeys.pending(patientId) });
      }
    },
  });
}
