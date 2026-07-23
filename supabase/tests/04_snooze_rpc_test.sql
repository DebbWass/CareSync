-- CareSync DB tests — snooze_event RPC (M5)
-- Atomic increment, status guard, and RLS enforcement under SECURITY INVOKER.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(8);

-- ── Fixtures (as postgres, bypassing RLS) ────────────────────────────────────
-- Patient P1 owns event E1 (pending) and E2 (already taken); P2 is unrelated.

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'snz-p1@test.dev', '{"name":"P1","role":"patient"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '70000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'snz-p2@test.dev', '{"name":"P2","role":"patient"}', '', '', '', '');

INSERT INTO public.medications (id, patient_id, name, dosage)
VALUES ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'SnoozeMed', '5mg');

INSERT INTO public.medication_schedules (id, medication_id, frequency_type, times_of_day)
VALUES ('71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'daily', ARRAY['08:00']);

INSERT INTO public.medication_events (id, schedule_id, medication_id, patient_id, scheduled_time, status) VALUES
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002',
   '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', NOW(), 'pending'),
  -- offset scheduled_time: UNIQUE(schedule_id, scheduled_time) forbids same-instant doses
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002',
   '71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', NOW() - INTERVAL '12 hours', 'taken');

-- ── Helper to switch simulated user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION test_as(uid UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END;
$$;

-- ── Function shape ───────────────────────────────────────────────────────────
SELECT has_function('public', 'snooze_event', ARRAY['uuid'],
    'snooze_event(uuid) exists');

-- ── Patient snoozes own pending event ────────────────────────────────────────
SELECT test_as('70000000-0000-4000-8000-000000000001');

SELECT is(
    (public.snooze_event('72000000-0000-4000-8000-000000000001')).snooze_count,
    1, 'first snooze increments count to 1 and returns the row');

SELECT is(
    (SELECT status FROM public.medication_events
     WHERE id = '72000000-0000-4000-8000-000000000001'),
    'snoozed'::event_status, 'snooze sets status to snoozed');

-- Repeat snooze keeps incrementing (single-UPDATE path — no read-then-write)
SELECT is(
    (public.snooze_event('72000000-0000-4000-8000-000000000001')).snooze_count,
    2, 'second snooze increments count to 2');

-- ── Status guard: a taken dose cannot be snoozed ─────────────────────────────
SELECT ok(
    public.snooze_event('72000000-0000-4000-8000-000000000002') IS NULL,
    'snoozing a taken event returns NULL');

SELECT is(
    (SELECT snooze_count FROM public.medication_events
     WHERE id = '72000000-0000-4000-8000-000000000002'),
    0, 'taken event snooze_count is untouched');

-- ── RLS: an unrelated user cannot snooze another patient's event ─────────────
SELECT test_as('70000000-0000-4000-8000-000000000002');

SELECT ok(
    public.snooze_event('72000000-0000-4000-8000-000000000001') IS NULL,
    'unrelated user gets NULL (RLS hides the row inside the RPC)');

SELECT test_as('70000000-0000-4000-8000-000000000001');

SELECT is(
    (SELECT snooze_count FROM public.medication_events
     WHERE id = '72000000-0000-4000-8000-000000000001'),
    2, 'foreign snooze attempt did not change the count');

SELECT * FROM finish();
ROLLBACK;
