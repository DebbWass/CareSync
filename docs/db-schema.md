# CareSync — Database Schema

**Version:** 1.0  
**Date:** 2026-05-09  
**Database:** PostgreSQL 15 (via Supabase)

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    │ 1:1 trigger
    ▼
public.users
    │
    ├──< patient_caregiver_relationships >── public.users (as caregiver)
    │         (many-to-many: patient ↔ caregiver)
    │
    └──< medications
              │
              └──< medication_schedules
                        │
                        └──< medication_events >── alerts
                                                      │
                                                      └── public.users (as caregiver)
```

---

## Migration 1: Initial Schema

**File:** `supabase/migrations/20260509000001_initial_schema.sql`

```sql
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
-- Mirrors Supabase auth.users; auto-created on auth registration via trigger.
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

-- Trigger: auto-create public.users row when a user registers via Supabase Auth
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
-- Supports multiple caregivers per patient.
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
-- Soft-delete via is_active (never hard-delete; historical events reference this).
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
-- Defines WHEN a medication should be taken (the template for generating events).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medication_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    frequency_type  frequency_type NOT NULL,
    -- Array of "HH:MM" strings in local time, e.g. '{"08:00","20:00"}'
    times_of_day    TEXT[] NOT NULL,
    -- NULL means every day; for weekly: array of ISO weekday integers [0=Sun ... 6=Sat]
    days_of_week    INTEGER[],
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,               -- NULL = ongoing indefinitely
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medication_events
-- One row per scheduled dose instance. The core audit log of the system.
-- IMMUTABLE: rows are never deleted. Status updates are the only writes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.medication_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
    medication_id   UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_time  TIMESTAMPTZ NOT NULL,
    taken_time      TIMESTAMPTZ,        -- NULL until patient confirms
    status          event_status NOT NULL DEFAULT 'pending',
    snooze_count    INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent duplicate events for the same schedule slot
    UNIQUE (schedule_id, scheduled_time)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: alerts
-- Caregiver inbox. Created by the caregiver-alert Edge Function.
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
-- FCM/APNs tokens for push notification delivery. Multiple devices per user.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,
    platform    push_platform NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);
```

---

## Migration 2: Row-Level Security Policies

**File:** `supabase/migrations/20260509000002_rls_policies.sql`

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caregiver_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper function: is the current authenticated user an active caregiver for patient?
-- SECURITY DEFINER runs with elevated privileges to avoid permission issues on
-- the relationships table during policy evaluation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_caregiver_for(patient UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.patient_caregiver_relationships
        WHERE caregiver_id = auth.uid()
          AND patient_id = patient
          AND status = 'active'
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────────────────────────────────────

-- Read own profile, OR read a patient's profile (if you're their caregiver),
-- OR read a caregiver's profile (if you're their patient — for display purposes)
CREATE POLICY "users_select" ON public.users
    FOR SELECT USING (
        id = auth.uid()
        OR public.is_caregiver_for(id)
        OR EXISTS (
            SELECT 1 FROM public.patient_caregiver_relationships
            WHERE patient_id = auth.uid()
              AND caregiver_id = id
              AND status = 'active'
        )
    );

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: patient_caregiver_relationships
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "relationships_select" ON public.patient_caregiver_relationships
    FOR SELECT USING (
        patient_id = auth.uid() OR caregiver_id = auth.uid()
    );

-- Caregivers can create relationship requests
CREATE POLICY "relationships_insert" ON public.patient_caregiver_relationships
    FOR INSERT WITH CHECK (caregiver_id = auth.uid());

-- Patients can accept/reject; caregivers can revoke
CREATE POLICY "relationships_update" ON public.patient_caregiver_relationships
    FOR UPDATE USING (
        patient_id = auth.uid() OR caregiver_id = auth.uid()
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "medications_select" ON public.medications
    FOR SELECT USING (
        patient_id = auth.uid() OR public.is_caregiver_for(patient_id)
    );

CREATE POLICY "medications_insert" ON public.medications
    FOR INSERT WITH CHECK (public.is_caregiver_for(patient_id));

CREATE POLICY "medications_update" ON public.medications
    FOR UPDATE USING (public.is_caregiver_for(patient_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medication_schedules
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "schedules_select" ON public.medication_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.medications m
            WHERE m.id = medication_id
              AND (m.patient_id = auth.uid() OR public.is_caregiver_for(m.patient_id))
        )
    );

CREATE POLICY "schedules_insert" ON public.medication_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.medications m
            WHERE m.id = medication_id
              AND public.is_caregiver_for(m.patient_id)
        )
    );

CREATE POLICY "schedules_update" ON public.medication_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.medications m
            WHERE m.id = medication_id
              AND public.is_caregiver_for(m.patient_id)
        )
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: medication_events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "events_select" ON public.medication_events
    FOR SELECT USING (
        patient_id = auth.uid() OR public.is_caregiver_for(patient_id)
    );

-- Only the patient can update their own events (confirm/snooze)
CREATE POLICY "events_update_patient" ON public.medication_events
    FOR UPDATE
    USING (patient_id = auth.uid())
    WITH CHECK (patient_id = auth.uid());

-- No DELETE policy — events are immutable

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: alerts
-- ─────────────────────────────────────────────────────────────────────────────

-- Caregivers see only their own alerts
CREATE POLICY "alerts_select" ON public.alerts
    FOR SELECT USING (caregiver_id = auth.uid());

-- Caregivers can mark their own alerts as read
CREATE POLICY "alerts_update_read" ON public.alerts
    FOR UPDATE
    USING (caregiver_id = auth.uid())
    WITH CHECK (caregiver_id = auth.uid());

-- INSERT is done by Edge Functions using service_role (bypasses RLS) — no policy needed

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: push_tokens
-- ─────────────────────────────────────────────────────────────────────────────

-- Users manage only their own tokens
CREATE POLICY "push_tokens_select" ON public.push_tokens
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_tokens_insert" ON public.push_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_delete" ON public.push_tokens
    FOR DELETE USING (user_id = auth.uid());
```

---

## Migration 3: Performance Indexes

**File:** `supabase/migrations/20260509000003_indexes.sql`

```sql
-- medication_events: primary scheduler query (upcoming pending events)
CREATE INDEX idx_events_pending_scheduled
    ON public.medication_events (scheduled_time)
    WHERE status = 'pending';

-- medication_events: patient history view (most recent first)
CREATE INDEX idx_events_patient_time
    ON public.medication_events (patient_id, scheduled_time DESC);

-- medication_events: caregiver adherence queries (by medication over time)
CREATE INDEX idx_events_medication_time
    ON public.medication_events (medication_id, scheduled_time DESC);

-- medication_events: overdue detection (status + time)
CREATE INDEX idx_events_status_time
    ON public.medication_events (status, scheduled_time);

-- alerts: caregiver inbox (unread alerts, newest first)
CREATE INDEX idx_alerts_caregiver_unread
    ON public.alerts (caregiver_id, created_at DESC)
    WHERE is_read = FALSE;

-- alerts: full inbox including read
CREATE INDEX idx_alerts_caregiver_all
    ON public.alerts (caregiver_id, created_at DESC);

-- patient_caregiver_relationships: lookup active caregivers for a patient
CREATE INDEX idx_relationships_patient_active
    ON public.patient_caregiver_relationships (patient_id, status)
    WHERE status = 'active';

-- patient_caregiver_relationships: lookup patients for a caregiver
CREATE INDEX idx_relationships_caregiver_active
    ON public.patient_caregiver_relationships (caregiver_id, status)
    WHERE status = 'active';

-- medication_schedules: active schedules (for scheduler)
CREATE INDEX idx_schedules_active
    ON public.medication_schedules (medication_id)
    WHERE is_active = TRUE;

-- push_tokens: lookup tokens by user
CREATE INDEX idx_push_tokens_user
    ON public.push_tokens (user_id);

-- medications: active medications for a patient
CREATE INDEX idx_medications_patient_active
    ON public.medications (patient_id)
    WHERE is_active = TRUE;
```

---

## Column Reference

### users

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | NO | — | FK to auth.users.id |
| email | TEXT | NO | — | User email (unique) |
| name | TEXT | NO | — | Display name |
| role | user_role | NO | — | 'patient' or 'caregiver' |
| phone | TEXT | YES | — | Optional phone number |
| avatar_url | TEXT | YES | — | Profile picture URL |
| created_at | TIMESTAMPTZ | NO | NOW() | Registration timestamp |

### medication_events (most important table)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | Primary key |
| schedule_id | UUID | NO | — | FK to medication_schedules |
| medication_id | UUID | NO | — | FK to medications (denormalized for query performance) |
| patient_id | UUID | NO | — | FK to users (denormalized for RLS performance) |
| scheduled_time | TIMESTAMPTZ | NO | — | When the dose was scheduled |
| taken_time | TIMESTAMPTZ | YES | NULL | When patient confirmed; NULL if not yet taken |
| status | event_status | NO | 'pending' | Current state of this dose |
| snooze_count | INTEGER | NO | 0 | Number of times snoozed |
| notes | TEXT | YES | NULL | Optional notes |
| created_at | TIMESTAMPTZ | NO | NOW() | When this event row was created |

**Status lifecycle:**
```
pending → taken     (patient confirms)
pending → snoozed   (patient snoozes; event recreated at snooze time)
pending → missed    (scheduler marks overdue after grace period)
snoozed → taken     (patient confirms on retry)
snoozed → missed    (scheduler marks after snooze_count >= SNOOZE_LIMIT)
```

---

## Design Decisions

**Why denormalize patient_id and medication_id into medication_events?**  
RLS policies check `patient_id = auth.uid()` — if patient_id required a JOIN to medications → schedules, every SELECT would need that join just for the permission check. Denormalization makes the RLS index-scannable.

**Why store times_of_day as TEXT[] instead of a separate table?**  
A medication with times ["08:00","20:00"] doesn't need a normalized schedule_times table — the array fits naturally in PostgreSQL and is easy to iterate in the Edge Function scheduler.

**Why UNIQUE on (schedule_id, scheduled_time) in medication_events?**  
The scheduler runs every 5 minutes. Without this constraint, a transient delay could cause the function to insert duplicate events for the same dose. The UNIQUE constraint provides idempotency guarantees.
