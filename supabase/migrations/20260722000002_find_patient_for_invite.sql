-- CareSync — find_patient_id_by_email RPC (M11 auth polish, 2026-07-22)
--
-- Fixes an invite bootstrapping bug: a caregiver inviting a patient by email
-- could never find them. The users_select RLS policy only exposes a caregiver's
-- own row and patients they are ALREADY linked to — so a not-yet-linked patient
-- looked up by email returns zero rows and the app reported "no patient found".
--
-- This SECURITY DEFINER helper resolves a PATIENT's user id by email, bypassing
-- RLS in a controlled, minimal way (returns only the id, and only for
-- role = 'patient'). The caller still inserts the relationship under RLS
-- (relationships_insert requires caregiver_id = auth.uid()), and the patient
-- must still accept it before any data is shared.
--
-- Enumeration note: like email_exists, this lets an authenticated caregiver
-- confirm a patient email is registered. That is acceptable and required for an
-- invite-by-email feature; no profile data beyond the opaque id is returned.

CREATE OR REPLACE FUNCTION public.find_patient_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT id
    FROM public.users
    WHERE LOWER(email) = LOWER(TRIM(p_email))
      AND role = 'patient'
    LIMIT 1;
$$;

-- Callable by signed-in caregivers (not anon — inviting requires a session).
GRANT EXECUTE ON FUNCTION public.find_patient_id_by_email(TEXT) TO authenticated;

COMMENT ON FUNCTION public.find_patient_id_by_email(TEXT) IS
    'Resolves a patient user id by email for the invite flow, bypassing '
    'users_select RLS (which hides not-yet-linked patients). Returns only the '
    'id, role=patient only. See migration header for the rationale.';
