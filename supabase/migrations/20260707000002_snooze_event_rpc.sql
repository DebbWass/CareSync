-- CareSync — atomic snooze RPC (M5)
--
-- The client used to snooze with a read-then-write pair (SELECT snooze_count,
-- then UPDATE snooze_count = n + 1). Two rapid taps could both read the same
-- value and lose an increment — and a lost increment delays the caregiver
-- alert that fires at SNOOZE_LIMIT. This function performs the increment in a
-- single UPDATE, so concurrent calls serialize on the row lock and every
-- snooze counts exactly once.
--
-- SECURITY INVOKER (the default) is load-bearing: the UPDATE runs under the
-- caller's RLS context, so the events_update_patient policy still guarantees
-- a patient can only snooze their own events. No new write surface opens.
--
-- The SNOOZE_LIMIT cap intentionally stays out of SQL: RLS already lets the
-- patient update snooze_count directly, so a cap here adds no security, and
-- duplicating the constant would create a second source of truth
-- (apps/mobile/src/constants/config.ts owns it).
--
-- Returns the updated row, or NULL when nothing was snoozable — the event is
-- not in a snoozable status (taken/missed), does not exist, or RLS hides it.
-- The client treats NULL as a conflict and refetches.

CREATE OR REPLACE FUNCTION public.snooze_event(p_event_id UUID)
RETURNS public.medication_events
LANGUAGE sql
VOLATILE
AS $$
    UPDATE public.medication_events
    SET status = 'snoozed',
        snooze_count = snooze_count + 1
    WHERE id = p_event_id
      AND status IN ('pending', 'snoozed')
    RETURNING *;
$$;

-- The blanket GRANT in the RLS migration ran before this function existed;
-- new functions need their own grant (CI runs on a bare postgres image).
GRANT EXECUTE ON FUNCTION public.snooze_event(UUID) TO authenticated, service_role;
