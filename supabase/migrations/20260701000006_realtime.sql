-- CareSync — Realtime publications
-- Adds tables to the supabase_realtime publication so clients can subscribe
-- to postgres_changes. Realtime delivery RESPECTS RLS: a caregiver only
-- receives change events for rows their policies allow them to SELECT.
--
-- alerts             → caregiver inbox updates live (badge count, new alerts)
-- medication_events  → caregiver dashboard reflects confirm/snooze/missed live
--
-- (The messages table is added to this publication by its own migration in a
-- later milestone.)

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_events;
