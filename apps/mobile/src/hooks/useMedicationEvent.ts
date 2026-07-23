import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmEvent,
  getEventById,
  getEventHistory,
  getPendingEvent,
  snoozeEvent,
} from '../services/supabase/events';
import { useAuthStore } from '../store/authStore';
import { useConfirmOutboxStore } from '../store/confirmOutboxStore';
import { AppError } from '../services/supabase/errors';
import type { MedicationEvent } from '../types';

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
    refetchInterval: 60 * 1000, // check for new reminders every minute
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
// Both mutations are optimistic: the patient must see the tap land instantly
// (a fullscreen reminder that keeps sitting there after "TAKEN" invites
// double-taps and confusion). onMutate snapshots the caches and applies the
// expected result; onError restores the snapshots; onSettled refetches truth.

interface EventMutationContext {
  prevPending: MedicationEvent | null | undefined;
  prevDetail: MedicationEvent | null | undefined;
}

/** Confirms a medication was taken. Optimistic; rolls back on failure. */
export function useConfirmEvent() {
  const qc = useQueryClient();
  const patientId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    // Capture the tap time up front. If the network is down, durably queue the
    // confirm (with that tap time) and treat the tap as done — the optimistic
    // cache stays 'taken' and the outbox syncs on reconnect. Non-network
    // failures (permission, etc.) still throw so onError rolls the UI back.
    mutationFn: async (eventId: string) => {
      const takenTime = new Date().toISOString();
      try {
        await confirmEvent(eventId, takenTime);
      } catch (err) {
        if (err instanceof AppError && err.code === 'network') {
          useConfirmOutboxStore.getState().enqueue(eventId, takenTime);
          return;
        }
        throw err;
      }
    },
    onMutate: async (eventId): Promise<EventMutationContext> => {
      const pendingKey = eventKeys.pending(patientId ?? '');
      const detailKey = eventKeys.byId(eventId);
      // Stop in-flight refetches from overwriting the optimistic state
      await qc.cancelQueries({ queryKey: pendingKey });
      await qc.cancelQueries({ queryKey: detailKey });

      const prevPending = qc.getQueryData<MedicationEvent | null>(pendingKey);
      const prevDetail = qc.getQueryData<MedicationEvent | null>(detailKey);

      // Home: the reminder disappears immediately
      qc.setQueryData<MedicationEvent | null>(pendingKey, null);
      // Deep-link screen: flips to the "confirmed" state immediately
      qc.setQueryData<MedicationEvent | null>(detailKey, (old) =>
        old ? { ...old, status: 'taken', taken_time: new Date().toISOString() } : old
      );

      return { prevPending, prevDetail };
    },
    onError: (_err, eventId, ctx) => {
      if (!ctx) return;
      qc.setQueryData(eventKeys.pending(patientId ?? ''), ctx.prevPending);
      qc.setQueryData(eventKeys.byId(eventId), ctx.prevDetail);
    },
    onSettled: (_data, _err, eventId) => {
      qc.invalidateQueries({ queryKey: eventKeys.byId(eventId) });
      if (patientId) {
        qc.invalidateQueries({ queryKey: eventKeys.pending(patientId) });
        qc.invalidateQueries({ queryKey: eventKeys.history(patientId) });
      }
    },
  });
}

/** Snoozes the current event (atomic RPC). Optimistic; rolls back on failure. */
export function useSnoozeEvent() {
  const qc = useQueryClient();
  const patientId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    mutationFn: (eventId: string) => snoozeEvent(eventId),
    onMutate: async (eventId): Promise<EventMutationContext> => {
      const pendingKey = eventKeys.pending(patientId ?? '');
      const detailKey = eventKeys.byId(eventId);
      await qc.cancelQueries({ queryKey: pendingKey });
      await qc.cancelQueries({ queryKey: detailKey });

      const prevPending = qc.getQueryData<MedicationEvent | null>(pendingKey);
      const prevDetail = qc.getQueryData<MedicationEvent | null>(detailKey);

      const applySnooze = (old: MedicationEvent | null | undefined) =>
        old && old.id === eventId
          ? { ...old, status: 'snoozed' as const, snooze_count: old.snooze_count + 1 }
          : old;

      qc.setQueryData<MedicationEvent | null>(pendingKey, applySnooze);
      qc.setQueryData<MedicationEvent | null>(detailKey, applySnooze);

      return { prevPending, prevDetail };
    },
    onError: (_err, eventId, ctx) => {
      if (!ctx) return;
      qc.setQueryData(eventKeys.pending(patientId ?? ''), ctx.prevPending);
      qc.setQueryData(eventKeys.byId(eventId), ctx.prevDetail);
    },
    // A null result means the dose was no longer snoozable (e.g. already
    // confirmed elsewhere) — onSettled's invalidation renders the true state.
    onSettled: (_data, _err, eventId) => {
      qc.invalidateQueries({ queryKey: eventKeys.byId(eventId) });
      if (patientId) {
        qc.invalidateQueries({ queryKey: eventKeys.pending(patientId) });
        qc.invalidateQueries({ queryKey: eventKeys.history(patientId) });
      }
    },
  });
}
