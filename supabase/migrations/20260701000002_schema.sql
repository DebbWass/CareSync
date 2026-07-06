-- CareSync — Core schema
-- 7 tables + enums. All tables get RLS in 20260701000004_rls.sql.
--
-- Domain rules encoded here:
-- * medication_events is the immutable audit log of the system
--   (enforced by triggers in 20260701000003_functions.sql).
-- * medications are soft-deleted via is_active — historical events
--   must keep resolving their medication.
-- * users.timezone drives reminder scheduling: times_of_day values are
--   wall-clock times in the PATIENT'S timezone; the scheduler converts
--   them to UTC instants when generating events.

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
-- Mirrors Supabase auth.users. Auto-created on auth registration via trigger
-- (defined in 20260701000003_functions.sql).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    role        user_role NOT NULL,
    phone       TEXT,
    avatar_url  TEXT,
    -- IANA timezone name. times_of_day in medication_schedules are wall-clock
    -- times in THIS timezone; the scheduler converts to UTC per patient.
    timezone    TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
    -- App language for this user. Patients default to Hebrew (elderly-first UX);
    -- notification titles are localized per recipient using this value.
    language    TEXT NOT NULL DEFAULT 'he' CHECK (language IN ('he', 'en')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: patient_caregiver_relationships
-- Many-to-many: one patient can have multiple active caregivers.
-- Never hard-deleted — access is revoked via status = 'revoked'.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.patient_caregiver_relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    caregiver_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status          relationship_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id, caregiver_id),
    CHECK (patient_id <> caregiver_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medications
-- Soft-delete via is_active — never hard-delete (historical events reference this).
-- created_by is SET NULL on caregiver deletion: the medication must outlive the
-- caregiver account (the patient still takes it); patient deletion cascades.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    dosage          TEXT NOT NULL,       -- e.g. "10mg", "2 tablets"
    instructions    TEXT,                -- e.g. "Take with food and water"
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
    -- Array of "HH:MM" wall-clock times in the patient's timezone,
    -- e.g. '{"08:00","20:00"}'
    times_of_day    TEXT[] NOT NULL CHECK (array_length(times_of_day, 1) >= 1),
    -- NULL = every day; for weekly schedules: [0=Sun, 1=Mon, ..., 6=Sat]
    days_of_week    INTEGER[],
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,                -- NULL = ongoing indefinitely
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medication_events
-- One row per scheduled dose instance. The IMMUTABLE AUDIT LOG of the system:
-- rows are never deleted, and only status/taken_time/snooze_count/notes may
-- change (triggers in 20260701000003_functions.sql enforce this for every
-- role, including service_role).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medication_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
    medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_time  TIMESTAMPTZ NOT NULL,
    taken_time      TIMESTAMPTZ,         -- NULL until patient confirms
    status          event_status NOT NULL DEFAULT 'pending',
    snooze_count    INTEGER NOT NULL DEFAULT 0 CHECK (snooze_count >= 0),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevents duplicate events for the same dose slot (idempotent scheduler)
    UNIQUE (schedule_id, scheduled_time)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: alerts
-- Caregiver inbox. Rows are created by the caregiver-alert Edge Function
-- (service_role) — clients can only read and mark as read.
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
-- Expo push tokens for notification delivery. Users may have multiple devices.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,
    platform    push_platform NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);
