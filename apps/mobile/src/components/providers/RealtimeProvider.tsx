/**
 * RealtimeProvider — live delivery for messages and caregiver alerts (M9).
 *
 * Renders nothing; mount once inside QueryClientProvider in the root layout.
 *
 * THE setAuth RULE (verified live in M8 — scripts/verify-realtime.mjs): the
 * realtime socket must carry the AUTHENTICATED token before subscribing,
 * otherwise it joins as `anon`, WALRUS evaluates RLS against anon, and
 * events are silently withheld — no error, just silence. The effect below
 * re-runs on every access-token change (including refreshes), calling
 * setAuth and resubscribing.
 *
 * Delivery: RLS scopes events server-side, so this single subscription per
 * user only ever receives rows the user is allowed to SELECT.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { alertKeys } from '../../hooks/useAlerts';
import { messageKeys } from '../../hooks/useMessages';
import type { Message } from '../../types';

export function RealtimeProvider() {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const userId = useAuthStore((s) => s.profile?.id);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (!accessToken || !userId) return;

    // Non-negotiable — see module docstring
    supabase.realtime.setAuth(accessToken);

    const channel = supabase
      .channel(`user-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message;
          qc.invalidateQueries({
            queryKey: messageKeys.thread(msg.patient_id, msg.caregiver_id),
          });
          // Incoming urgent message → the patient sees it fullscreen, now
          if (role === 'patient' && msg.sender_id !== userId) {
            router.push(`/message/${msg.id}`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          // Receipt transitions (delivered/read) refresh the sender's thread
          const msg = payload.new as Message;
          qc.invalidateQueries({
            queryKey: messageKeys.thread(msg.patient_id, msg.caregiver_id),
          });
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => {
        // Caregiver inbox goes live (was refetch-on-focus since M1)
        qc.invalidateQueries({ queryKey: alertKeys.list(userId) });
        qc.invalidateQueries({ queryKey: alertKeys.count(userId) });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accessToken, userId, role, qc]);

  return null;
}
