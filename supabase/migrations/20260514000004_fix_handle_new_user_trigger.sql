-- Fix auth signup trigger failures when creating public.users profile rows.
-- Root cause: unqualified enum cast and brittle metadata assumptions could raise
-- "Database error saving new user" during auth sign-up.

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
