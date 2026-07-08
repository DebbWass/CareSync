-- CareSync DB tests — adherence_stats RPC (M10)
-- Patient-local day bucketing (the midnight edge), resolved-only denominator,
-- the local-day window, and RLS (SECURITY INVOKER) enforcement.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(8);

-- ── Fixtures (as postgres, bypassing RLS) ────────────────────────────────────
-- Patient P1 in Asia/Jerusalem; caregiver C1 actively cares for P1; caregiver
-- C2 is unrelated. handle_new_user mirrors auth.users → public.users.

INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'adh-p1@test.dev', '{"name":"P1","role":"patient"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'adh-c1@test.dev', '{"name":"C1","role":"caregiver"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '80000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'adh-c2@test.dev', '{"name":"C2","role":"caregiver"}', '', '', '', '');

-- Pin the patient's timezone so the bucketing math is deterministic.
UPDATE public.users SET timezone = 'Asia/Jerusalem'
WHERE id = '80000000-0000-4000-8000-000000000001';

INSERT INTO public.patient_caregiver_relationships (id, patient_id, caregiver_id, status)
VALUES ('80000000-0000-4000-8000-000000000010',
        '80000000-0000-4000-8000-000000000001',
        '80000000-0000-4000-8000-000000000002', 'active');

INSERT INTO public.medications (id, patient_id, name, dosage)
VALUES ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'AdhMed', '5mg');

INSERT INTO public.medication_schedules (id, medication_id, frequency_type, times_of_day)
VALUES ('81000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', 'daily', ARRAY['08:00']);

-- Events. Jerusalem is UTC+2 in January (standard time, no DST):
--   A 2026-01-15 23:00Z → 2026-01-16 01:00 local  (UTC date Jan 15, LOCAL date Jan 16)
--   B 2026-01-16 21:30Z → 2026-01-16 23:30 local  (LOCAL date Jan 16)
--   → A and B share LOCAL day Jan-16, even though A's UTC date is Jan-15.
--   C, D land on local Jan-17 but are pending/snoozed → excluded from adherence.
INSERT INTO public.medication_events
    (id, schedule_id, medication_id, patient_id, scheduled_time, status, taken_time) VALUES
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002',
   '81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001',
   '2026-01-15 23:00:00+00', 'taken', '2026-01-15 23:05:00+00'),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002',
   '81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001',
   '2026-01-16 21:30:00+00', 'missed', NULL),
  ('82000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000002',
   '81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001',
   '2026-01-17 06:00:00+00', 'pending', NULL),
  ('82000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000002',
   '81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001',
   '2026-01-17 07:00:00+00', 'snoozed', NULL);

-- ── Helper to switch simulated user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION test_as(uid UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END;
$$;

-- ── Function shape ───────────────────────────────────────────────────────────
SELECT has_function('public', 'adherence_stats', ARRAY['uuid', 'integer'],
    'adherence_stats(uuid, integer) exists');

-- ── Caregiver reads their patient's stats ────────────────────────────────────
SELECT test_as('80000000-0000-4000-8000-000000000002');

-- The midnight edge: A (UTC Jan-15) and B (UTC Jan-16) collapse into ONE local
-- day. A UTC-naive bucketer would report two days here.
SELECT is(
    (SELECT count(*)::int FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 3650)),
    1, 'resolved doses collapse into a single patient-local day (pending/snoozed excluded)');

SELECT is(
    (SELECT bucket_day FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 3650)),
    '2026-01-16'::date, 'a 23:00Z dose buckets to the next patient-local day, not its UTC day');

SELECT is(
    (SELECT total_doses FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 3650)),
    2::bigint, 'both resolved doses count toward the denominator');

SELECT is(
    (SELECT taken_doses FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 3650)),
    1::bigint, 'only the taken dose counts toward the numerator');

-- ── The window is measured in patient-local days ─────────────────────────────
-- January is far outside a 30-day window anchored to "today", so it drops out.
SELECT is(
    (SELECT count(*)::int FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 30)),
    0, 'a 30-day window excludes doses older than 30 local days');

-- ── RLS: an unrelated caregiver sees nothing (SECURITY INVOKER) ──────────────
SELECT test_as('80000000-0000-4000-8000-000000000003');

SELECT is(
    (SELECT count(*)::int FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 3650)),
    0, 'an unrelated caregiver gets no rows — RLS hides the events inside the RPC');

-- ── The patient can read their own stats ─────────────────────────────────────
SELECT test_as('80000000-0000-4000-8000-000000000001');

SELECT is(
    (SELECT count(*)::int FROM public.adherence_stats(
        '80000000-0000-4000-8000-000000000001', 3650)),
    1, 'the patient can read their own adherence');

SELECT * FROM finish();
ROLLBACK;
