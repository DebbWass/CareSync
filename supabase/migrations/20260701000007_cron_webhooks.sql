-- CareSync — Scheduler cron job + caregiver-alert webhook
--
-- Wires the notification pipeline:
-- 1. pg_cron calls the medication-scheduler Edge Function every 5 minutes.
-- 2. A DB webhook fires the caregiver-alert Edge Function on every
--    medication_events UPDATE (the function itself filters for
--    missed / snooze-limit transitions).
--
-- Both use two database-level GUC settings that must be configured per
-- environment (they are read AT RUNTIME by the cron job, so the migration
-- itself never embeds secrets):
--
--   ALTER DATABASE postgres SET app.supabase_url      = '<project url>';
--   ALTER DATABASE postgres SET app.service_role_key  = '<service role key>';
--
-- Local dev:   url = http://host.docker.internal:54321 and the local demo
--              service_role key from `supabase status` (see docs/deployment.md).
-- Hosted:      run once via the SQL editor with the project's real values.

-- ── pg_cron: medication-scheduler every 5 minutes ────────────────────────────
-- current_setting(...) inside the command is evaluated when the JOB RUNS,
-- not when it is scheduled — safe to create before the GUCs are set.
SELECT cron.schedule(
    'medication-scheduler-every-5min',   -- job name (must be unique)
    '*/5 * * * *',                       -- every 5 minutes
    $$
    SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/medication-scheduler',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{}'::jsonb
    )
    $$
);

-- ── DB webhook: caregiver-alert on medication_events UPDATE ──────────────────
-- Implemented as a plain trigger + pg_net (works identically on local and
-- hosted Supabase, unlike supabase_functions.hooks which is Dashboard-managed).
-- The GUCs are read at trigger-fire time with missing_ok = true: if they are
-- not configured yet, the trigger is a silent no-op instead of breaking
-- patient confirm/snooze writes.

CREATE OR REPLACE FUNCTION public.notify_caregiver_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_url TEXT := current_setting('app.supabase_url', true);
    srk      TEXT := current_setting('app.service_role_key', true);
BEGIN
    IF base_url IS NULL OR srk IS NULL THEN
        RETURN NEW;  -- environment not wired yet — never block the UPDATE
    END IF;

    -- Only fire on transitions the alert function cares about; everything else
    -- is filtered here to avoid pointless HTTP calls on every confirm.
    IF (NEW.status = 'missed' AND OLD.status IS DISTINCT FROM 'missed')
       OR (NEW.snooze_count >= 3 AND OLD.snooze_count < 3)
    THEN
        PERFORM net.http_post(
            url     := base_url || '/functions/v1/caregiver-alert',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || srk
            ),
            body    := jsonb_build_object(
                'type',       'UPDATE',
                'table',      'medication_events',
                'schema',     'public',
                'record',     to_jsonb(NEW),
                'old_record', to_jsonb(OLD)
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER medication_events_caregiver_alert
    AFTER UPDATE ON public.medication_events
    FOR EACH ROW EXECUTE FUNCTION public.notify_caregiver_alert();
