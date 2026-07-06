-- CareSync — Extensions
-- pg_cron:   schedules the medication-scheduler Edge Function (every 5 min)
-- pg_net:    lets cron jobs / triggers call Edge Functions over HTTP
-- pgcrypto:  gen_random_uuid() (also used by seed data for password hashing)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
