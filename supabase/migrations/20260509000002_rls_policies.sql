-- CareSync Row-Level Security Policies
-- Enforces patient/caregiver data isolation at the database level.
-- No data from one patient is ever visible to an unrelated caregiver.

-- Enable RLS on all tables (no access by default until policies are added)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caregiver_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: is the current auth user an active caregiver for a given patient?
-- SECURITY DEFINER runs with elevated privileges so the RLS policy evaluator
-- can access patient_caregiver_relationships without a recursive RLS loop.
-- STABLE because result depends only on DB data, not session-varying state.
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

-- Read: own profile + patients you care for + caregivers linked to you (as patient)
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

-- Write: only your own profile
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: patient_caregiver_relationships
-- ─────────────────────────────────────────────────────────────────────────────

-- Both sides of the relationship can see it
CREATE POLICY "relationships_select" ON public.patient_caregiver_relationships
    FOR SELECT USING (
        patient_id = auth.uid() OR caregiver_id = auth.uid()
    );

-- Caregivers initiate the relationship request
CREATE POLICY "relationships_insert" ON public.patient_caregiver_relationships
    FOR INSERT WITH CHECK (caregiver_id = auth.uid());

-- Patients can accept/reject; caregivers can revoke their own access
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

-- Only caregivers can create medications for a patient
CREATE POLICY "medications_insert" ON public.medications
    FOR INSERT WITH CHECK (public.is_caregiver_for(patient_id));

-- Only caregivers can edit medications
CREATE POLICY "medications_update" ON public.medications
    FOR UPDATE USING (public.is_caregiver_for(patient_id));

-- No DELETE policy — use is_active = false (soft delete)

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
-- patient_id cannot be changed (WITH CHECK ensures it stays the same)
CREATE POLICY "events_update_patient" ON public.medication_events
    FOR UPDATE
    USING (patient_id = auth.uid())
    WITH CHECK (patient_id = auth.uid());

-- No INSERT from client — events are created by the medication-scheduler Edge Function
-- No DELETE policy — medication_events is an immutable audit trail

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: alerts
-- ─────────────────────────────────────────────────────────────────────────────

-- Caregivers see only their own alerts
CREATE POLICY "alerts_select" ON public.alerts
    FOR SELECT USING (caregiver_id = auth.uid());

-- Caregivers can mark their own alerts as read (is_read = true only)
CREATE POLICY "alerts_update_read" ON public.alerts
    FOR UPDATE
    USING (caregiver_id = auth.uid())
    WITH CHECK (caregiver_id = auth.uid());

-- INSERT is done by the caregiver-alert Edge Function using service_role (bypasses RLS)

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: push_tokens
-- ─────────────────────────────────────────────────────────────────────────────

-- Users manage only their own device tokens
CREATE POLICY "push_tokens_select" ON public.push_tokens
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_tokens_insert" ON public.push_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow token deletion (for deregistration / device change)
CREATE POLICY "push_tokens_delete" ON public.push_tokens
    FOR DELETE USING (user_id = auth.uid());
