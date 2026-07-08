-- CareSync — adherence analytics RPC (M10)
--
-- Caregivers need to see how consistently a patient takes their doses. The one
-- honest number is: of the doses that have actually resolved (taken or missed),
-- what fraction were taken. Pending and still-snoozed doses are unresolved and
-- must NOT drag the number down — a dose due tonight is not a miss yet.
--
-- The subtle part is the day boundary. `scheduled_time` is a UTC instant derived
-- from the patient's local wall clock (see docs/db-schema.md). A dose at 23:30
-- Asia/Jerusalem is 20:30 UTC (summer) — bucketing it by its UTC date would file
-- last night's pill under today. So every bucket uses the *patient's* timezone:
--   (scheduled_time AT TIME ZONE u.timezone)::date
-- which re-projects the instant back to the wall clock the patient experienced,
-- then truncates to their local calendar day. The window is likewise counted in
-- local days, anchored to the patient's "today", not the server's.
--
-- SECURITY INVOKER (the default) is load-bearing: the function reads
-- medication_events and users under the caller's RLS context, so a caregiver
-- only ever sees a patient they actively care for, and passing an arbitrary
-- patient_id simply returns no rows (RLS hides them) rather than leaking data.
-- No new read surface opens; this is a convenience projection over rows the
-- caller could already SELECT.
--
-- Returns one row per local day that had at least one resolved dose, oldest
-- first. The client sums taken/total for the headline adherence %, and renders
-- the per-day rows as the trend. Days with no resolved dose are simply absent
-- (the client treats a gap as "nothing scheduled/resolved", not 0%).

CREATE OR REPLACE FUNCTION public.adherence_stats(
    p_patient_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    bucket_day  DATE,
    total_doses BIGINT,
    taken_doses BIGINT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        (e.scheduled_time AT TIME ZONE u.timezone)::date          AS bucket_day,
        COUNT(*)                                                  AS total_doses,
        COUNT(*) FILTER (WHERE e.status = 'taken')                AS taken_doses
    FROM public.medication_events e
    JOIN public.users u ON u.id = e.patient_id
    WHERE e.patient_id = p_patient_id
      -- Only resolved doses count toward adherence; pending/snoozed are unsettled.
      AND e.status IN ('taken', 'missed')
      -- Last p_days local days, inclusive of the patient's today.
      AND (e.scheduled_time AT TIME ZONE u.timezone)::date
            > (now() AT TIME ZONE u.timezone)::date - GREATEST(p_days, 1)
    GROUP BY 1
    ORDER BY 1;
$$;

-- The blanket GRANT in the RLS migration ran before this function existed;
-- new functions need their own grant (CI runs on a bare postgres image).
GRANT EXECUTE ON FUNCTION public.adherence_stats(UUID, INTEGER) TO authenticated, service_role;
