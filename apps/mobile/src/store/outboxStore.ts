/**
 * Offline outbox for urgent messages (M9).
 *
 * Send = enqueue + flush. The entry — including its client_id idempotency
 * key — is persisted BEFORE the first network attempt, so a crash or dead
 * spot can never lose a message or double-send it:
 *  - flush success or 23505-duplicate (sendMessage returns instead of
 *    throwing) → entry removed; the message exists server-side exactly once.
 *  - network failure → entry kept with exponential backoff
 *    (2^attempts seconds, capped at 60s); retried on reconnect/app start.
 *  - permanent failure (permission — e.g. the relationship was revoked) →
 *    entry dropped; retrying forever would never succeed.
 *
 * The NetInfo reconnect trigger lives in useOutboxFlusher (root layout) —
 * the store itself has no subscriptions or import side effects.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage } from '../services/supabase/messages';
import { AppError } from '../services/supabase/errors';

export interface OutboxEntry {
  client_id: string;
  patient_id: string;
  caregiver_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attempts: number;
  /** Epoch ms; flush skips entries that are still backing off. */
  next_attempt_at: number;
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 60_000;

function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_CAP_MS);
}

interface OutboxState {
  entries: OutboxEntry[];
  /** True while a flush pass is running (prevents concurrent passes). */
  flushing: boolean;

  enqueue: (entry: Omit<OutboxEntry, 'attempts' | 'next_attempt_at' | 'created_at'>) => void;
  /** Attempt every due entry once. Safe to call often; no-op when empty. */
  flush: () => Promise<void>;
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      entries: [],
      flushing: false,

      enqueue: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, created_at: new Date().toISOString(), attempts: 0, next_attempt_at: 0 },
          ],
        })),

      flush: async () => {
        if (get().flushing) return;
        set({ flushing: true });
        try {
          const due = get().entries.filter((e) => e.next_attempt_at <= Date.now());

          for (const entry of due) {
            try {
              await sendMessage({
                patient_id: entry.patient_id,
                caregiver_id: entry.caregiver_id,
                sender_id: entry.sender_id,
                body: entry.body,
                client_id: entry.client_id,
              });
              // Sent (or already existed — 23505 handled inside sendMessage)
              set((state) => ({
                entries: state.entries.filter((e) => e.client_id !== entry.client_id),
              }));
            } catch (err) {
              const retryable = err instanceof AppError && err.code === 'network';
              if (retryable) {
                set((state) => ({
                  entries: state.entries.map((e) =>
                    e.client_id === entry.client_id
                      ? {
                          ...e,
                          attempts: e.attempts + 1,
                          next_attempt_at: Date.now() + backoffMs(e.attempts + 1),
                        }
                      : e
                  ),
                }));
                // Offline: later entries will fail identically — stop the pass
                break;
              }
              // Permanent (permission/unknown): drop — it will never succeed
              console.warn('[outbox] dropping unsendable message:', (err as Error).message);
              set((state) => ({
                entries: state.entries.filter((e) => e.client_id !== entry.client_id),
              }));
            }
          }
        } finally {
          set({ flushing: false });
        }
      },
    }),
    {
      name: 'caresync-outbox',
      storage: createJSONStorage(() => AsyncStorage),
      // flushing is runtime state, never persisted
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);
