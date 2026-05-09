-- CareSync Initial Schema
-- Creates all 7 core tables, enums, and the auth trigger.
-- Applied first — all other migrations depend on this.

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('patient', 'caregiver');
CREATE TYPE relationship_status AS ENUM ('pending', 'active', 'revoked');
CREATE TYPE frequency_type AS ENUM (
    'daily',
    'twice_daily',
    'three_times_daily',
    'weekly',
    'custom'
);
CREATE TYPE event_status AS ENUM ('pending', 'taken', 'snoozed', 'missed');
CREATE TYPE alert_type AS ENUM (
    'missed',
    'snoozed_limit',
    'low_adherence',
    'new_medication'
);
CREATE TYPE push_platform AS ENUM ('ios', 'android');

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: public.users
-- Mirrors Supabase auth.users. Auto-created on auth registration via trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    role        user_role NOT NULL,
    phone       TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create public.users row when auth.users row is created.
-- The mobile app passes name and role in signUp metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        (NEW.raw_user_meta_data->>'role')::user_role
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: patient_caregiver_relationships
-- Many-to-many: one patient can have multiple active caregivers.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.patient_caregiver_relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caregiver_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status          relationship_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, caregiver_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medications
-- Soft-delete via is_active — never hard-delete (historical events reference this).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES public.users(id),
    name            TEXT NOT NULL,
    dosage          TEXT NOT NULL,       -- e.g. "10mg", "2 tablets"
    instructions    TEXT,               -- e.g. "Take with food and water"
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medication_schedules
-- Defines WHEN a medication should be taken (the template for event generation).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medication_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    frequency_type  frequency_type NOT NULL,
    -- Array of "HH:MM" time strings, e.g. '{"08:00","20:00"}'
    times_of_day    TEXT[] NOT NULL,
    -- NULL = every day; for weekly schedules: [0=Sun, 1=Mon, ..., 6=Sat]
    days_of_week    INTEGER[],
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,               -- NULL = ongoing indefinitely
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medication_events
-- One row per scheduled dose instance. The immutable audit log of the system.
-- NEVER DELETE rows from this table — it is the healthcare audit trail.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medication_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
    medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_time  TIMESTAMPTZ NOT NULL,
    taken_time      TIMESTAMPTZ,        -- NULL until patient confirms
    status          event_status NOT NULL DEFAULT 'pending',
    snooze_count    INTEGER NOT NULL DEFAULT 0 CHECK (snooze_count >= 0),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevents duplicate events for the same dose slot (idempotent scheduler)
    UNIQUE (schedule_id, scheduled_time)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: alerts
-- Caregiver inbox. Rows are created by the caregiver-alert Edge Function.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caregiver_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES public.medication_events(id) ON DELETE SET NULL,
    alert_type      alert_type NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: push_tokens
-- FCM/APNs device tokens for push notification delivery.
-- Users may have multiple devices registered.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,
    platform    push_platform NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);
