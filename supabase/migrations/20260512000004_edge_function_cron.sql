-- Migration: Edge Function cron + DB webhook setup
-- Phase 7: Wire up medication-scheduler cron and caregiver-alert webhook

-- ── pg_cron: medication-scheduler every 5 minutes ────────────────────────────
-- Requires pg_cron extension (enabled on all Supabase projects by default).
-- Calls the medication-scheduler Edge Function via net.http_post (pg_net).

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the medication-scheduler Edge Function to run every 5 minutes.
-- The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available as GUC settings
-- on the Supabase managed platform.
select
  cron.schedule(
    'medication-scheduler-every-5min',   -- job name (must be unique)
    '*/5 * * * *',                        -- every 5 minutes
    $$
    select
      net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/medication-scheduler',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{}'::jsonb
      )
    $$
  );

-- ── Supabase DB webhook: caregiver-alert on medication_events UPDATE ──────────
-- This creates a webhook that fires whenever a row in medication_events is
-- updated. The caregiver-alert Edge Function inspects old_record vs record
-- and only acts on missed/snooze-limit transitions.
--
-- On the hosted Supabase platform the webhook can alternatively be configured
-- in the Dashboard → Database → Webhooks, but including it in migrations keeps
-- it in version control.

insert into supabase_functions.hooks (
  hook_table_id,
  hook_name,
  hook_service_id,
  request_method,
  request_url,
  request_headers,
  request_params
)
select
  t.oid,
  'caregiver-alert-on-event-update',
  1,            -- Supabase Functions service
  'POST',
  current_setting('app.supabase_url') || '/functions/v1/caregiver-alert',
  jsonb_build_array(
    jsonb_build_object('name', 'Content-Type', 'value', 'application/json'),
    jsonb_build_object('name', 'Authorization', 'value', 'Bearer ' || current_setting('app.service_role_key'))
  ),
  '{}'::jsonb
from
  pg_class t
  join pg_namespace n on t.relnamespace = n.oid
where
  n.nspname = 'public'
  and t.relname = 'medication_events'
on conflict do nothing;
