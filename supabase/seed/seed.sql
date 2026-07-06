-- CareSync — Local development seed data
-- Applied automatically by `supabase db reset` (config.toml → db.seed).
-- LOCAL DEV ONLY — never run against a production project.
--
-- Test accounts (password for both: Password123!)
--   patient@caresync.test    — Yaakov Wass  (patient,  Hebrew, Asia/Jerusalem)
--   caregiver@caresync.test  — Debra Wass   (caregiver, English, Asia/Jerusalem)
--
-- Contents: active patient↔caregiver relationship, 2 medications with daily
-- schedules, 7 days of historical medication events with a deterministic
-- taken/missed/snoozed pattern (so adherence numbers are hand-verifiable),
-- and a small alert inbox.

-- ─────────────────────────────────────────────────────────────────────────────
-- Auth users (GoTrue) — the handle_new_user trigger mirrors these into
-- public.users with the name/role passed in raw_user_meta_data.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES
(
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'patient@caresync.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Yaakov Wass", "role": "patient"}',
    NOW(), NOW(), '', '', '', ''
),
(
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'caregiver@caresync.test',
    extensions.crypt('Password123!', extensions.gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Debra Wass", "role": "caregiver"}',
    NOW(), NOW(), '', '', '', ''
);

INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
)
SELECT
    gen_random_uuid(), u.id, u.id::text, 'email',
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    NOW(), NOW(), NOW()
FROM auth.users u
WHERE u.email IN ('patient@caresync.test', 'caregiver@caresync.test');

-- Language/timezone preferences (profiles were created by the trigger)
UPDATE public.users SET language = 'he', timezone = 'Asia/Jerusalem'
WHERE id = '00000000-0000-4000-8000-000000000001';
UPDATE public.users SET language = 'en', timezone = 'Asia/Jerusalem'
WHERE id = '00000000-0000-4000-8000-000000000002';

-- ─────────────────────────────────────────────────────────────────────────────
-- Relationship: Debra actively cares for Yaakov
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.patient_caregiver_relationships (id, patient_id, caregiver_id, status)
VALUES (
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'active'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Medications + schedules (times are wall-clock in the patient's timezone)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.medications (id, patient_id, created_by, name, dosage, instructions) VALUES
(
    '00000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Donepezil', '10mg', 'Take in the evening, with or without food'
),
(
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'Vitamin D', '1000 IU', 'Take with breakfast'
);

INSERT INTO public.medication_schedules
    (id, medication_id, frequency_type, times_of_day, start_date) VALUES
(
    '00000000-0000-4000-8000-000000000030',
    '00000000-0000-4000-8000-000000000020',
    'twice_daily', ARRAY['08:00', '20:00'], CURRENT_DATE - 14
),
(
    '00000000-0000-4000-8000-000000000031',
    '00000000-0000-4000-8000-000000000021',
    'daily', ARRAY['09:00'], CURRENT_DATE - 14
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Historical medication events — last 7 full days, deterministic pattern.
--
-- Per (day, slot), day_offset 1..7 (1 = yesterday):
--   day_offset % 5 = 0            → missed  (day 5)
--   else day_offset % 3 = 0       → taken after 2 snoozes (days 3, 6)
--   else                          → taken ~5 min after schedule
--
-- Donepezil (2 slots/day): 14 events → 12 taken / 2 missed → 85.7% adherence
-- Vitamin D  (1 slot/day):  7 events →  6 taken / 1 missed → 85.7% adherence
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.medication_events
    (schedule_id, medication_id, patient_id, scheduled_time, taken_time, status, snooze_count)
SELECT
    s.schedule_id,
    s.medication_id,
    '00000000-0000-4000-8000-000000000001',
    sched.utc_time,
    CASE WHEN d.day_offset % 5 <> 0
         THEN sched.utc_time + INTERVAL '5 minutes'
              + (CASE WHEN d.day_offset % 3 = 0 THEN INTERVAL '20 minutes' ELSE INTERVAL '0' END)
    END,
    CASE WHEN d.day_offset % 5 = 0 THEN 'missed'::event_status ELSE 'taken'::event_status END,
    CASE WHEN d.day_offset % 5 <> 0 AND d.day_offset % 3 = 0 THEN 2 ELSE 0 END
FROM (VALUES
    ('00000000-0000-4000-8000-000000000030'::uuid, '00000000-0000-4000-8000-000000000020'::uuid, '08:00'::time),
    ('00000000-0000-4000-8000-000000000030'::uuid, '00000000-0000-4000-8000-000000000020'::uuid, '20:00'::time),
    ('00000000-0000-4000-8000-000000000031'::uuid, '00000000-0000-4000-8000-000000000021'::uuid, '09:00'::time)
) AS s(schedule_id, medication_id, slot_time)
CROSS JOIN generate_series(1, 7) AS d(day_offset)
CROSS JOIN LATERAL (
    -- Wall-clock slot in the patient's timezone converted to a UTC instant
    SELECT ((CURRENT_DATE - d.day_offset) + s.slot_time)
               AT TIME ZONE 'Asia/Jerusalem' AS utc_time
) AS sched;

-- One pending dose for today (next upcoming slot), so the patient home screen
-- has something to show immediately after `supabase db reset`.
INSERT INTO public.medication_events
    (id, schedule_id, medication_id, patient_id, scheduled_time, status)
VALUES (
    '00000000-0000-4000-8000-000000000040',
    '00000000-0000-4000-8000-000000000030',
    '00000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    (CURRENT_DATE + TIME '20:00') AT TIME ZONE 'Asia/Jerusalem',
    'pending'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Alerts: one unread (yesterday's missed dose pattern) + one read
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.alerts (patient_id, caregiver_id, event_id, alert_type, is_read)
SELECT
    e.patient_id,
    '00000000-0000-4000-8000-000000000002',
    e.id,
    'missed',
    (ROW_NUMBER() OVER (ORDER BY e.scheduled_time DESC)) > 1  -- newest stays unread
FROM public.medication_events e
WHERE e.status = 'missed'
ORDER BY e.scheduled_time DESC
LIMIT 2;
