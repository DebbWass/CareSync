-- CareSync DB tests — Row-Level Security matrix
-- Fixtures are created as postgres (bypasses RLS), then assertions run as the
-- `authenticated` role with request.jwt.claims simulating each user.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Patient P1 with active caregiver C1; unrelated patient P2; caregiver C2 with
-- only a PENDING relationship to P1 (must behave as no access).

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'p1@test.dev', '{"name":"P1","role":"patient"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'c1@test.dev', '{"name":"C1","role":"caregiver"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'p2@test.dev', '{"name":"P2","role":"patient"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'c2@test.dev', '{"name":"C2","role":"caregiver"}', '', '', '', '');

INSERT INTO public.patient_caregiver_relationships (patient_id, caregiver_id, status) VALUES
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'active'),
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'pending');

INSERT INTO public.medications (id, patient_id, created_by, name, dosage) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000002', 'TestMed', '5mg');

INSERT INTO public.medication_schedules (id, medication_id, frequency_type, times_of_day) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'daily', ARRAY['08:00']);

INSERT INTO public.medication_events (id, schedule_id, medication_id, patient_id, scheduled_time) VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', NOW());

-- ── Helper to switch simulated user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION test_as(uid UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END;
$$;

-- ── Active caregiver C1: full read access to P1's data ──────────────────────
SELECT test_as('10000000-0000-4000-8000-000000000002');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medications
     WHERE patient_id = '10000000-0000-4000-8000-000000000001'),
    1, 'active caregiver sees patient medications');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medication_events
     WHERE patient_id = '10000000-0000-4000-8000-000000000001'),
    1, 'active caregiver sees patient events');

SELECT is(
    (SELECT COUNT(*)::int FROM public.users
     WHERE id = '10000000-0000-4000-8000-000000000001'),
    1, 'active caregiver sees patient profile');

-- ── Unrelated patient P2: sees nothing of P1 ─────────────────────────────────
SELECT test_as('10000000-0000-4000-8000-000000000003');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medications),
    0, 'unrelated user sees zero medications');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medication_events),
    0, 'unrelated user sees zero events');

SELECT is(
    (SELECT COUNT(*)::int FROM public.users
     WHERE id <> '10000000-0000-4000-8000-000000000003'),
    0, 'unrelated user sees no other profiles');

-- ── PENDING caregiver C2: no data access until activated ────────────────────
SELECT test_as('10000000-0000-4000-8000-000000000004');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medications),
    0, 'pending caregiver sees zero medications');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medication_events),
    0, 'pending caregiver sees zero events');

-- ── Patient P1: owns their data, but cannot create medications ──────────────
SELECT test_as('10000000-0000-4000-8000-000000000001');

SELECT is(
    (SELECT COUNT(*)::int FROM public.medications),
    1, 'patient sees own medications');

SELECT throws_ok(
    $$ INSERT INTO public.medications (patient_id, name, dosage)
       VALUES ('10000000-0000-4000-8000-000000000001', 'Rogue', '1mg') $$,
    '42501', NULL,
    'patient cannot insert medications (caregiver-only)');

-- Patient can confirm their own dose
UPDATE public.medication_events
SET status = 'taken', taken_time = NOW()
WHERE id = '40000000-0000-4000-8000-000000000001';

SELECT is(
    (SELECT status FROM public.medication_events
     WHERE id = '40000000-0000-4000-8000-000000000001'),
    'taken'::event_status, 'patient can confirm own dose');

-- Client role cannot insert events (service_role only)
SELECT throws_ok(
    $$ INSERT INTO public.medication_events (schedule_id, medication_id, patient_id, scheduled_time)
       VALUES ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
               '10000000-0000-4000-8000-000000000001', NOW() + INTERVAL '1 hour') $$,
    '42501', NULL,
    'clients cannot insert medication_events');

SELECT * FROM finish();
ROLLBACK;
