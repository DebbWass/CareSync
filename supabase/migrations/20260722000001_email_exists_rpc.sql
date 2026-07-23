-- CareSync — email_exists RPC (M11 auth polish, 2026-07-22)
--
-- Lets the UNAUTHENTICATED forgot-password screen tell the user when no
-- account exists for the email they typed, and lets the register screen show
-- an "email already in use" message on every backend config.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY / PRIVACY NOTE — deliberate trade-off
-- ─────────────────────────────────────────────────────────────────────────────
-- This function reveals whether an email is registered, which enables email
-- enumeration. That is an EXPLICIT product decision (2026-07-22) to give
-- clearer UX on the password-reset screen; it intentionally overrides GoTrue's
-- default anti-enumeration behavior (which never discloses account existence).
--
-- If enumeration ever becomes a concern: REVOKE the anon grant below and
-- revert forgot-password.tsx to the neutral "if an account exists…" copy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM auth.users
        WHERE LOWER(email) = LOWER(TRIM(p_email))
          AND deleted_at IS NULL
    );
$$;

-- Callable before login (anon) — that is the entire purpose of this helper.
GRANT EXECUTE ON FUNCTION public.email_exists(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.email_exists(TEXT) IS
    'Returns true if a non-deleted auth user exists for the given email. '
    'Deliberately enumerable (product decision 2026-07-22) — used by the '
    'forgot-password and register screens for clearer UX.';
