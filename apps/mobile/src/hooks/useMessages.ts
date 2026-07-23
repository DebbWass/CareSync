import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import {
  getMessageById,
  getThread,
  markMessageRead,
  markThreadRead,
} from '../services/supabase/messages';
import { useOutboxStore } from '../store/outboxStore';
import { useAuthStore } from '../store/authStore';
import type { Message } from '../types';

// ── Query keys ────────────────────────────────────────────────────────────────

export const messageKeys = {
  thread: (patientId: string, caregiverId: string) =>
    ['messages', 'thread', patientId, caregiverId] as const,
  byId: (messageId: string) => ['messages', 'detail', messageId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Conversation for a pair. Realtime invalidates it; polling is the fallback. */
export function useThread(patientId: string, caregiverId: string) {
  return useQuery({
    queryKey: messageKeys.thread(patientId, caregiverId),
    queryFn: () => getThread(patientId, caregiverId),
    enabled: !!patientId && !!caregiverId,
    refetchInterval: 30 * 1000,
  });
}

/** Single message — the push-tap fullscreen popup target. */
export function useMessageById(messageId: string | null) {
  return useQuery({
    queryKey: messageKeys.byId(messageId ?? ''),
    queryFn: () => (messageId ? getMessageById(messageId) : null),
    enabled: !!messageId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface SendInput {
  patient_id: string;
  caregiver_id: string;
  body: string;
}

/**
 * Send = enqueue in the persisted outbox + flush. The message appears in the
 * thread cache immediately (optimistic, status 'sent'); the outbox owns
 * delivery — offline sends go out automatically on reconnect, and the
 * client_id idempotency key makes retries exactly-once.
 */
export function useSendMessage() {
  const qc = useQueryClient();
  const senderId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (input: SendInput) => {
      if (!senderId) throw new Error('not signed in');
      const clientId = randomUUID();

      useOutboxStore.getState().enqueue({
        client_id: clientId,
        patient_id: input.patient_id,
        caregiver_id: input.caregiver_id,
        sender_id: senderId,
        body: input.body,
      });

      // Optimistic thread append — the outbox will reconcile with the server
      const optimistic: Message = {
        id: `outbox-${clientId}`,
        patient_id: input.patient_id,
        caregiver_id: input.caregiver_id,
        sender_id: senderId,
        body: input.body,
        client_id: clientId,
        status: 'sent',
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<Message[]>(
        messageKeys.thread(input.patient_id, input.caregiver_id),
        (old) => [...(old ?? []), optimistic]
      );

      // Fire the flush; a network failure keeps the entry queued — that is
      // the success path for offline sends, not an error to surface
      await useOutboxStore.getState().flush();
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({
        queryKey: messageKeys.thread(input.patient_id, input.caregiver_id),
      });
    },
  });
}

/** Patient popup acknowledge — marks one message read. */
export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => markMessageRead(messageId),
    onSuccess: (_data, messageId) => {
      qc.invalidateQueries({ queryKey: messageKeys.byId(messageId) });
      qc.invalidateQueries({ queryKey: ['messages', 'thread'] });
    },
  });
}

/** Caregiver opens a thread — every unread incoming message becomes read. */
export function useMarkThreadRead() {
  const qc = useQueryClient();
  const readerId = useAuthStore((s) => s.profile?.id);
  return useMutation({
    mutationFn: ({ patientId, caregiverId }: { patientId: string; caregiverId: string }) =>
      readerId ? markThreadRead(patientId, caregiverId, readerId) : Promise.resolve(),
    onSuccess: (_data, { patientId, caregiverId }) => {
      qc.invalidateQueries({ queryKey: messageKeys.thread(patientId, caregiverId) });
    },
  });
}
