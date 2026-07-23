# CareSync — Database Schema

**Version:** 2.0 (production rebuild, milestone M1)
**Date:** 2026-07-06
**Database:** PostgreSQL 17 (via Supabase)

The migration files under `supabase/migrations/` are the source of truth.
This document explains the model and the reasoning; it intentionally does not
mirror the SQL line by line.

---

## Entity Relationship Overview

```
auth.users (Supabase managed)
    │ 1:1 trigger (handle_new_user)
    ▼
public.users  (role: patient | caregiver, timezone, language)
    │
    ├──< patient_caregiver_relationships >── public.users (as caregiver)
    │         (many-to-many: patient ↔ caregiver, status-gated)
    │
    └──< medications  (soft-delete via is_active)
              │
              └──< medication_schedules  (times_of_day = patient-local wall clock)
                        │
                        └──< medication_events  (IMMUTABLE audit log)
                                  │
                                  └──< alerts ──> public.users (as caregiver)

public.users ──< push_tokens  (one row per device)
```

---

## Migration Set

| File | Contents |
|---|---|
| `20260701000001_extensions.sql` | `pgcrypto`, `pg_cron`, `pg_net` |
| `20260701000002_schema.sql` | 6 enums + 7 tables (all columns, FKs, CHECKs, UNIQUEs) |
| `20260701000003_functions.sql` | `handle_new_user` trigger, `is_caregiver_for` RLS helper, `medication_events` immutability triggers |
| `20260701000004_rls.sql` | RLS enablement + all 22 policies |
| `20260701000005_indexes.sql` | 11 performance indexes + `idx_alerts_dedup` unique index |
| `20260701000006_realtime.sql` | `alerts` and `medication_events` added to the `supabase_realtime` publication |
| `20260701000007_cron_webhooks.sql` | pg_cron job (scheduler every 5 min) + caregiver-alert webhook trigger |
| `20260707000001_event_notified_at.sql` | `medication_events.notified_at` (one push per dose) + partial index (M4) |
| `20260707000002_snooze_event_rpc.sql` | `snooze_event(uuid)` atomic snooze RPC, SECURITY INVOKER (M5) |
| `20260708000001_messages.sql` | `messages`: idempotent sends, monotonic receipts, RLS, realtime, INSERT webhook → message-push (M8) |
| `20260708000002_adherence_stats.sql` | `adherence_stats(uuid, int)` analytics RPC — patient-local day bucketing, resolved-only denominator, SECURITY INVOKER (M10) |
| `20260722000001_email_exists_rpc.sql` | `email_exists(text)` — SECURITY DEFINER, granted to **anon**; lets the pre-login forgot-password / register screens report whether an account exists (M11). **Deliberately enumerable** — an explicit product decision that overrides GoTrue's anti-enumeration default (see the migration header to revert). |
| `20260722000002_find_patient_for_invite.sql` | `find_patient_id_by_email(text)` — SECURITY DEFINER, granted to **authenticated**; resolves a `role='patient'` user id by email for the invite flow. Needed because `users_select` RLS hides patients a caregiver isn't linked to yet, which otherwise made "invite by email" always fail (M11). Returns only the id. |
| `20260723000001_patient_invitations.sql` | `get_patient_invitations()` — SECURITY DEFINER, granted to **authenticated**; returns the calling patient's PENDING invitations joined to the inviting caregiver's name/email (scoped to `auth.uid()`). Needed because `users_select` RLS hides the caregiver profile until the link is active, so the patient couldn't see who invited them (M11). Accept/decline/cancel reuse the existing `relationships_update` RLS. |

**Dev loop:** `supabase db reset` re-runs all migrations and applies
`supabase/seed/seed.sql`. `supabase test db` runs the pgTAP suite in
`supabase/tests/`.

---

## Column Reference (key tables)

### users

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | NO | — | FK to auth.users.id (CASCADE) |
| email | TEXT | NO | — | User email (unique) |
| name | TEXT | NO | — | Display name |
| role | user_role | NO | — | 'patient' or 'caregiver' |
| phone | TEXT | YES | — | Optional phone number |
| avatar_url | TEXT | YES | — | Profile picture URL |
| timezone | TEXT | NO | 'Asia/Jerusalem' | IANA zone; interprets times_of_day |
| language | TEXT | NO | 'he' | App + notification language ('he' or 'en') |
| created_at | TIMESTAMPTZ | NO | NOW() | Registration timestamp |

### medication_events (the audit log — most important table)

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | NO | gen_random_uuid() | Primary key |
| schedule_id | UUID | NO | — | FK to medication_schedules |
| medication_id | UUID | NO | — | FK to medications (denormalized for query performance) |
| patient_id | UUID | NO | — | FK to users (denormalized for RLS performance) |
| scheduled_time | TIMESTAMPTZ | NO | — | The dose's UTC instant (converted from patient-local wall clock) |
| taken_time | TIMESTAMPTZ | YES | NULL | When the patient confirmed |
| status | event_status | NO | 'pending' | pending / taken / snoozed / missed |
| snooze_count | INTEGER | NO | 0 | CHECK >= 0 |
| notes | TEXT | YES | NULL | Optional notes |
| notified_at | TIMESTAMPTZ | YES | NULL | When the reminder push was handed to the provider (M4) |
| created_at | TIMESTAMPTZ | NO | NOW() | Row creation time |

**Status lifecycle:**
```
pending → taken     (patient confirms)
pending → snoozed   (patient snoozes)
pending → missed    (scheduler marks overdue after grace period)
snoozed → taken     (patient confirms on retry)
snoozed → missed    (scheduler marks after snooze_count >= SNOOZE_LIMIT)
```

**Immutability (trigger-enforced, applies to every role including
service_role):** rows can never be DELETEd, and UPDATEs may only change
`status`, `taken_time`, `snooze_count`, `notes`, `notified_at`. The identity
of a dose — what, for whom, when — is frozen at creation.

**Snoozing is atomic (M5):** the client calls the `snooze_event(uuid)` RPC,
a single `UPDATE … SET snooze_count = snooze_count + 1` guarded to
`pending`/`snoozed` status. SECURITY INVOKER, so the patient-only UPDATE
policy still applies inside the function. Returns the updated row, or NULL
when the dose was no longer snoozable (the client refetches and shows the
true state). The SNOOZE_LIMIT cap deliberately stays in app config — RLS
already lets a patient write `snooze_count` directly, so a SQL cap would add
duplication, not security.

---

## Security Model (RLS)

Every table has RLS enabled. The mobile client uses the `anon`/`authenticated`
key and can only reach rows its policies allow; Edge Functions use
`service_role` (bypasses RLS, but NOT the immutability triggers).

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| users | self + related patients/caregivers | trigger only | self | — |
| relationships | either side | caregiver (self) | either side | — (revoke via status) |
| medications | patient or active caregiver | active caregiver | active caregiver | — (soft delete) |
| medication_schedules | via medication access | active caregiver | active caregiver | — |
| medication_events | patient or active caregiver | service_role only | patient (own) | — (never) |
| alerts | owning caregiver | service_role only | owning caregiver (mark read) | — |
| push_tokens | self | self | — | self |
| messages | either side of the pair | sender (active relationship only, no forgery) | recipient (receipts only) | — (never, trigger-blocked) |

`is_caregiver_for(patient UUID)` — SECURITY DEFINER + STABLE — is the single
point where "active caregiver" is defined (`status = 'active'`; pending and
revoked relationships grant nothing).

---

## Notification Pipeline Wiring

- **Cron:** `medication-scheduler-every-5min` (pg_cron) POSTs to the
  medication-scheduler Edge Function via `pg_net`.
- **Webhook:** an `AFTER UPDATE` trigger on `medication_events`
  (`notify_caregiver_alert`) POSTs to the caregiver-alert Edge Function, and
  only for the transitions that matter (became `missed`, or `snooze_count`
  crossed the limit).
- **Webhook (M8):** an `AFTER INSERT` trigger on `messages`
  (`notify_message_push`) POSTs to the message-push Edge Function, which
  pushes `{type:'message', message_id}` (no body, no names — PHI rule) to
  the recipient. Realtime note: `messages` has `REPLICA IDENTITY FULL` and
  is in the `supabase_realtime` publication; clients MUST call
  `realtime.setAuth(token)` before subscribing or RLS silently withholds
  events (verified live — `npm run verify:realtime`).

Both read two database GUCs **at runtime** (no secrets in migrations):

```sql
ALTER DATABASE postgres SET app.supabase_url     = '<project url>';
ALTER DATABASE postgres SET app.service_role_key = '<service role key>';
```

Until these are set, the cron job fails harmlessly and the webhook trigger is
a silent no-op — patient confirm/snooze writes are never blocked. Environment
setup is documented in `docs/deployment.md`.

---

## Design Decisions

**Why denormalize patient_id and medication_id into medication_events?**
RLS policies check `patient_id = auth.uid()` — without denormalization every
SELECT would join through medications → schedules just for the permission
check. Denormalization makes RLS index-scannable.

**Why is timezone on users, and what does times_of_day mean?**
`times_of_day` values ("08:00") are wall-clock times in the *patient's*
timezone. The scheduler loads `users.timezone`, computes the patient-local
slot, and stores the resulting UTC instant in `scheduled_time`. This is what
keeps an 08:00 pill at 08:00 across DST transitions.

**Why UNIQUE (schedule_id, scheduled_time)?**
The scheduler runs every 5 minutes; upsert + this constraint makes event
generation idempotent — double runs can never create duplicate doses.

**Why UNIQUE (caregiver_id, event_id, alert_type) on alerts?**
The caregiver-alert function inserts with `ON CONFLICT DO NOTHING`, so a
double-fired webhook is a no-op. The index includes caregiver_id because one
event legitimately fans out to *multiple* caregivers — dedup must be
per-recipient. (NULL event_id rows — e.g. low_adherence — are exempt: NULLs
never collide in a unique index.)

**Why is medications.created_by nullable with ON DELETE SET NULL?**
The medication must outlive the caregiver account that created it — the
patient still takes it. Deleting the *patient* cascades everything, which is
correct.

**Why is adherence a SECURITY INVOKER function instead of a view or a
SECURITY DEFINER RPC?** `adherence_stats(patient_id, days)` is a thin projection
over `medication_events`. Running it as INVOKER means the caller's RLS decides
which rows it can see — a caregiver gets their active patients, a patient gets
themselves, and an arbitrary id returns no rows. A DEFINER function would have
to re-implement `is_caregiver_for` access control by hand; INVOKER inherits it
for free. It buckets by `(scheduled_time AT TIME ZONE users.timezone)::date` so
a 23:30 local dose lands on the patient's local day, not the UTC day, and counts
only resolved doses (taken + missed) — a pending dose due tonight is not a miss.

**Why triggers for immutability instead of just "no RLS policy"?**
RLS does not bind service_role. The audit-log guarantee has to hold even
against buggy Edge Function code, so it is enforced at the trigger level.

**Why a plain trigger + pg_net for the webhook instead of supabase_functions.hooks?**
The Dashboard-managed hooks table doesn't exist on a fresh local stack and
would evaluate configuration at migration time. A trigger works identically
in local Docker and hosted Supabase, is version-controlled, and pre-filters
transitions so confirms don't generate pointless HTTP calls.

---

## Seed Data (local dev only)

`supabase/seed/seed.sql` creates (password for both: `Password123!`):

- `patient@caresync.test` — Yaakov Wass (patient, Hebrew, Asia/Jerusalem)
- `caregiver@caresync.test` — Debra Wass (caregiver, English)
- An active relationship, 2 medications (Donepezil 2×/day, Vitamin D 1×/day)
- 7 days of history with a deterministic pattern → **85.7% adherence for both
  medications** (hand-verifiable in analytics), 1 pending dose today
- 2 missed-dose alerts (1 unread)
