-- CareSync — patient-side invitation support (M11 auth polish, 2026-07-23)
--
-- The caregiver can invite a patient (creates a pending relationship), but the
-- patient had no way to SEE or ACCEPT it: users_select RLS hides the caregiver's
-- profile while the relationship is still 'pending', so the patient can't even
-- learn who invited them. This helper closes that loop.

-- ─────────────────────────────────────────────────────────────────────────────
-- get_patient_invitations
-- Returns the current user's PENDING invitations, joined to the inviting
-- caregiver's name/email. SECURITY DEFINER to read across the still-hidden
-- caregiver profile; scoped strictly to auth.uid() as the patient so it can
-- never leak another user's invitations.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_patient_invitations()
RETURNS TABLE (
    relationship_id UUID,
    caregiver_id    UUID,
    caregiver_name  TEXT,
    caregiver_email TEXT,
    created_at      TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT r.id, c.id, c.name, c.email, r.created_at
    FROM public.patient_caregiver_relationships r
    JOIN public.users c ON c.id = r.caregiver_id
    WHERE r.patient_id = auth.uid()
      AND r.status = 'pending'
    ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_invitations() TO authenticated;

COMMENT ON FUNCTION public.get_patient_invitations() IS
    'Pending invitations for the calling patient (auth.uid()), with the inviting '
    'caregiver name/email. SECURITY DEFINER because users_select hides the '
    'caregiver profile until the relationship is active.';
