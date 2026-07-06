-- CareSync DB tests — schema shape, constraints, triggers
-- Run with: supabase test db
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

-- Tables exist
SELECT has_table('public', 'users', 'users table exists');
SELECT has_table('public', 'patient_caregiver_relationships', 'relationships table exists');
SELECT has_table('public', 'medications', 'medications table exists');
SELECT has_table('public', 'medication_schedules', 'schedules table exists');
SELECT has_table('public', 'medication_events', 'events table exists');
SELECT has_table('public', 'alerts', 'alerts table exists');
SELECT has_table('public', 'push_tokens', 'push_tokens table exists');

-- New rebuild columns
SELECT has_column('public', 'users', 'timezone', 'users.timezone exists');
SELECT has_column('public', 'users', 'language', 'users.language exists');
SELECT col_not_null('public', 'users', 'timezone', 'users.timezone is NOT NULL');
SELECT col_default_is('public', 'users', 'timezone', '''Asia/Jerusalem''::text', 'timezone defaults to Asia/Jerusalem');
SELECT col_default_is('public', 'users', 'language', '''he''::text', 'language defaults to Hebrew');

-- created_by must be nullable (ON DELETE SET NULL target)
SELECT col_is_null('public', 'medications', 'created_by', 'medications.created_by is nullable');

-- Idempotency + dedup constraints
SELECT col_is_unique('public', 'medication_events', ARRAY['schedule_id', 'scheduled_time'],
    'events unique per (schedule, slot) — idempotent scheduler');
SELECT has_index('public', 'alerts', 'idx_alerts_dedup', 'alert dedup index exists');
SELECT index_is_unique('public', 'alerts', 'idx_alerts_dedup', 'alert dedup index is UNIQUE');

-- RLS enabled everywhere
SELECT row_security_active('public.users');
SELECT row_security_active('public.medications');
SELECT row_security_active('public.medication_events');
SELECT row_security_active('public.alerts');

-- Functions
SELECT has_function('public', 'handle_new_user', 'handle_new_user exists');
SELECT has_function('public', 'is_caregiver_for', ARRAY['uuid'], 'is_caregiver_for exists');
SELECT has_function('public', 'enforce_event_immutability', 'immutability trigger fn exists');
SELECT has_function('public', 'notify_caregiver_alert', 'caregiver-alert webhook fn exists');

SELECT * FROM finish();
ROLLBACK;
