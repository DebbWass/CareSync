/**
 * Offline outbox for medication confirmations (M11).
 *
 * "I took my pill" is the one tap that must never be lost to a dead network.
 * When confirmEvent fails offline, the confirmation is persisted here — WITH
 * the tap-time `taken_time` — before we give up, so:
 *  - the audit log records when the patient *actually* took the dose, not when
 *    the phone happened to reconnect;
 *  - a crash between tap and sync cannot drop it;
 *  - replay is idempotent — confirmEvent guards on `status <> 'taken'`, so a
 *    dose already confirmed elsewhere is left untouched (first write wins).
 *
 * enqueue dedupes on event_id (a second tap keeps the first tap's time). flush
 * mirrors the message outbox: network failures back off (2^attempts s, capped
 * 60s) and retry on reconnect/app-start; permanent failures (permission, the
 * dose vanished) are dropped rather than retried forever. The NetInfo trigger
 * lives in the root-layout flusher; this store has no subscriptions.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { confirmEvent } from '../services/supabase/events';
import { AppError } from '../services/supabase/errors';

export interface ConfirmOutboxEntry {
  event_id: string;
  /** ISO tap time — replayed verbatim so the audit record stays honest. */
  taken_time: string;
  attempts: number;
  /** Epoch ms; flush skips entries that are still backing off. */
  next_attempt_at: number;
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 60_000;

function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_CAP_MS);
}

interface ConfirmOutboxState {
  entries: ConfirmOutboxEntry[];
  flushing: boolean;

  enqueue: (eventId: string, takenTime: string) => void;
  /** Attempt every due entry once. Safe to call often; no-op when empty. */
  flush: () => Promise<void>;
}

export const useConfirmOutboxStore = create<ConfirmOutboxState>()(
  persist(
    (set, get) => ({
      entries: [],
      flushing: false,

      enqueue: (eventId, takenTime) =>
        set((state) =>
          // First tap wins — never overwrite an earlier queued taken_time.
          state.entries.some((e) => e.event_id === eventId)
            ? state
            : {
                entries: [
                  ...state.entries,
                  { event_id: eventId, taken_time: takenTime, attempts: 0, next_attempt_at: 0 },
                ],
              }
        ),

      flush: async () => {
        if (get().flushing) return;
        set({ flushing: true });
        try {
          const due = get().entries.filter((e) => e.next_attempt_at <= Date.now());

          for (const entry of due) {
            try {
              await confirmEvent(entry.event_id, entry.taken_time);
              // Confirmed (or already taken — the status guard made it a no-op)
              set((state) => ({
                entries: state.entries.filter((e) => e.event_id !== entry.event_id),
              }));
            } catch (err) {
              const retryable = err instanceof AppError && err.code === 'network';
              if (retryable) {
                set((state) => ({
                  entries: state.entries.map((e) =>
                    e.event_id === entry.event_id
                      ? {
                          ...e,
                          attempts: e.attempts + 1,
                          next_attempt_at: Date.now() + backoffMs(e.attempts + 1),
                        }
                      : e
                  ),
                }));
                // Offline: later entries fail identically — stop the pass
                break;
              }
              // Permanent (permission/notFound/unknown): drop — it can't succeed
              console.warn('[confirm-outbox] dropping unsendable confirm:', (err as Error).message);
              set((state) => ({
                entries: state.entries.filter((e) => e.event_id !== entry.event_id),
              }));
            }
          }
        } finally {
          set({ flushing: false });
        }
      },
    }),
    {
      name: 'caresync-confirm-outbox',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);
