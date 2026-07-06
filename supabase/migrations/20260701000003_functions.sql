-- CareSync — Database functions and triggers
--
-- 1. handle_new_user      — mirrors auth.users into public.users on signup
-- 2. is_caregiver_for     — RLS helper (active caregiver check)
-- 3. medication_events immutability — the audit-log guarantee

-- ─────────────────────────────────────────────────────────────────────────────
-- handle_new_user
-- Auto-creates the public.users profile row when an auth user registers.
-- Hardened: tolerates missing/invalid metadata (defaults role to 'patient',
-- derives a name from the email), idempotent via ON CONFLICT, and pins
-- search_path so enum casts resolve unambiguously.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_role TEXT;
    resolved_role public.user_role;
    resolved_name TEXT;
BEGIN
    raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));

    resolved_role := CASE raw_role
        WHEN 'caregiver' THEN 'caregiver'::public.user_role
        WHEN 'patient' THEN 'patient'::public.user_role
        ELSE 'patient'::public.user_role
    END;

    resolved_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'name', '')), '');

    INSERT INTO public.users (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(resolved_name, NULLIF(SPLIT_PART(NEW.email, '@', 1), ''), 'User'),
        resolved_role
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- is_caregiver_for
-- RLS helper: is the current auth user an ACTIVE caregiver for this patient?
-- SECURITY DEFINER so the policy evaluator can read the relationships table
-- without a recursive RLS loop. STABLE: result depends only on DB data.
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
-- medication_events immutability
-- This table is the healthcare audit trail:
-- * DELETE is never allowed — for any role, including service_role
--   (triggers fire regardless of RLS bypass).
-- * UPDATE may only touch status, taken_time, snooze_count, notes.
--   Identity columns (what dose, for whom, when it was due) are frozen.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_event_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'medication_events is an immutable audit log — DELETE is not allowed'
            USING ERRCODE = 'raise_exception';
    END IF;

    IF NEW.id             IS DISTINCT FROM OLD.id
       OR NEW.schedule_id    IS DISTINCT FROM OLD.schedule_id
       OR NEW.medication_id  IS DISTINCT FROM OLD.medication_id
       OR NEW.patient_id     IS DISTINCT FROM OLD.patient_id
       OR NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time
       OR NEW.created_at     IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'medication_events identity columns are immutable — only status, taken_time, snooze_count and notes may change'
            USING ERRCODE = 'raise_exception';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER medication_events_no_delete
    BEFORE DELETE ON public.medication_events
    FOR EACH ROW EXECUTE FUNCTION public.enforce_event_immutability();

CREATE TRIGGER medication_events_limit_update
    BEFORE UPDATE ON public.medication_events
    FOR EACH ROW EXECUTE FUNCTION public.enforce_event_immutability();
