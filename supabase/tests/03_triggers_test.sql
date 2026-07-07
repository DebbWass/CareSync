-- CareSync DB tests — trigger behavior
-- handle_new_user hardening + medication_events immutability + alert dedup
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(11);

-- ── handle_new_user ──────────────────────────────────────────────────────────

-- Normal signup with metadata
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES ('00000000-0000-0000-0000-000000000000', '50000000-0000-4000-8000-000000000001',
        'authenticated', 'authenticated', 'meta@test.dev',
        '{"name":"Full Meta","role":"caregiver"}', '', '', '', '');

SELECT is(
    (SELECT name FROM public.users WHERE id = '50000000-0000-4000-8000-000000000001'),
    'Full Meta', 'profile name comes from metadata');
SELECT is(
    (SELECT role FROM public.users WHERE id = '50000000-0000-4000-8000-000000000001'),
    'caregiver'::user_role, 'profile role comes from metadata');
SELECT is(
    (SELECT language FROM public.users WHERE id = '50000000-0000-4000-8000-000000000001'),
    'he', 'new profiles default to Hebrew');

-- Signup with NO metadata: name falls back to email prefix, role to patient
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES ('00000000-0000-0000-0000-000000000000', '50000000-0000-4000-8000-000000000002',
        'authenticated', 'authenticated', 'bare@test.dev', '{}', '', '', '', '');

SELECT is(
    (SELECT name FROM public.users WHERE id = '50000000-0000-4000-8000-000000000002'),
    'bare', 'missing name falls back to email prefix');
SELECT is(
    (SELECT role FROM public.users WHERE id = '50000000-0000-4000-8000-000000000002'),
    'patient'::user_role, 'missing role defaults to patient');

-- Garbage role must not break signup
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES ('00000000-0000-0000-0000-000000000000', '50000000-0000-4000-8000-000000000003',
        'authenticated', 'authenticated', 'garbage@test.dev',
        '{"role":"superadmin"}', '', '', '', '');

SELECT is(
    (SELECT role FROM public.users WHERE id = '50000000-0000-4000-8000-000000000003'),
    'patient'::user_role, 'invalid role coerced to patient (never errors)');

-- ── medication_events immutability ───────────────────────────────────────────

INSERT INTO public.medications (id, patient_id, name, dosage)
VALUES ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'M', '1mg');
INSERT INTO public.medication_schedules (id, medication_id, frequency_type, times_of_day)
VALUES ('60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'daily', ARRAY['08:00']);
INSERT INTO public.medication_events (id, schedule_id, medication_id, patient_id, scheduled_time)
VALUES ('60000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000002',
        '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', NOW());

-- DELETE blocked even for superuser/service_role (trigger, not RLS)
SELECT throws_ok(
    $$ DELETE FROM public.medication_events
       WHERE id = '60000000-0000-4000-8000-000000000003' $$,
    'P0001', NULL,
    'events can never be deleted (audit log)');

-- Identity columns frozen
SELECT throws_ok(
    $$ UPDATE public.medication_events
       SET scheduled_time = NOW() + INTERVAL '1 day'
       WHERE id = '60000000-0000-4000-8000-000000000003' $$,
    'P0001', NULL,
    'scheduled_time cannot be rewritten');

-- Status transitions allowed
UPDATE public.medication_events
SET status = 'snoozed', snooze_count = 1
WHERE id = '60000000-0000-4000-8000-000000000003';

SELECT is(
    (SELECT snooze_count FROM public.medication_events
     WHERE id = '60000000-0000-4000-8000-000000000003'),
    1, 'status/snooze updates are allowed');

-- notified_at is pipeline state, not identity — updatable (M4)
UPDATE public.medication_events
SET notified_at = NOW()
WHERE id = '60000000-0000-4000-8000-000000000003';

SELECT ok(
    (SELECT notified_at IS NOT NULL FROM public.medication_events
     WHERE id = '60000000-0000-4000-8000-000000000003'),
    'notified_at update is allowed by the immutability trigger');

-- ── alert dedup ──────────────────────────────────────────────────────────────

INSERT INTO public.alerts (patient_id, caregiver_id, event_id, alert_type)
VALUES ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000003', 'missed');

-- Same (caregiver, event, type) again with ON CONFLICT DO NOTHING → no dup
INSERT INTO public.alerts (patient_id, caregiver_id, event_id, alert_type)
VALUES ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000003', 'missed')
ON CONFLICT (caregiver_id, event_id, alert_type) DO NOTHING;

SELECT is(
    (SELECT COUNT(*)::int FROM public.alerts
     WHERE event_id = '60000000-0000-4000-8000-000000000003'),
    1, 'duplicate alert insert is a no-op (dedup index)');

SELECT * FROM finish();
ROLLBACK;
