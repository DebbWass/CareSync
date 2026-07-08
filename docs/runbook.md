# CareSync — Production Runbook

**Version:** 1.0 (M11 release-prep) · **Status:** current
**Audience:** whoever deploys or operates CareSync in production.

This is the authoritative operational runbook. It supersedes the release
sections of the older `docs/deployment.md` (which predates the production
rebuild). Architecture details it references live in `docs/db-schema.md` and
`docs/notification-flow.md` (both current).

> Golden rules that constrain every procedure here:
> 1. **`medication_events` is an immutable audit log** — never DELETE, never
>    UPDATE anything but `status`/`taken_time`/`snooze_count`/`notes`/
>    `notified_at`. Trigger-enforced, binds even `service_role`.
> 2. **Migrations are append-only.** The one-time consolidation is done; from
>    here every schema change is a new timestamped migration.
> 3. **No PHI in push payloads.** Only opaque IDs (`event_id`/`alert_id`/
>    `message_id`). Do not "improve" a notification by adding a name.
> 4. **`service_role` lives only server-side** (Edge Functions + the DB GUC).
>    The mobile app ships the `anon` key, constrained by RLS.

---

## 1. Prerequisites

- Supabase CLI ≥ 2.98 (`supabase --version`), authenticated (`supabase login`).
- A Supabase **production** project (separate from any dev project).
- An Expo/EAS account with the `caresync` project (project id in `app.json` →
  `expo.extra.eas.projectId`); `eas login`.
- Repo checked out at the release commit on `main` (promote `develop → main`
  first — see §5).

---

## 2. Supabase backend deploy

Run from the repo root unless noted. `supabase link --project-ref <ref>` once.

### 2.1 Apply migrations (append-only)

```bash
supabase db push          # applies supabase/migrations/* in order
```

Migrations never destroy data. If a push fails midway, fix forward with a new
migration — do **not** hand-edit an already-applied file.

### 2.2 Deploy Edge Functions

Four functions (Deno). Deploy all after any `_shared/` change:

```bash
supabase functions deploy medication-scheduler
supabase functions deploy send-push
supabase functions deploy caregiver-alert
supabase functions deploy message-push
```

### 2.3 Wire runtime config (GUCs + secrets)

The cron job and DB webhooks read two database GUCs **at runtime** (no secrets
in migrations). Set them once per project:

```sql
ALTER DATABASE postgres SET app.supabase_url     = 'https://<ref>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<service_role key>';
```

Until these are set the cron job fails harmlessly and the webhook trigger is a
silent no-op — patient confirm/snooze writes are never blocked. Edge Functions
additionally need the `service_role` key as a function secret if they call back
into the project:

```bash
supabase secrets set SERVICE_ROLE_KEY='<service_role key>'
```

Verify: `pg_cron` job `medication-scheduler-every-5min` exists and `pg_net`
requests are flowing (`select * from cron.job;`, `select * from net._http_response order by created desc limit 5;`).

### 2.4 Auth email (password reset)

The M7 forgot/reset flow uses Supabase's built-in SMTP by default — fine for a
first release. For volume or deliverability, configure **custom SMTP** in the
Supabase dashboard (Auth → SMTP) and set the redirect allow-list to include
`caresync://reset-password`.

### 2.5 Verify

```bash
supabase test db          # 77 pgTAP assertions must pass against the schema
npm run scheduler:run     # exercises the scheduler against the linked stack
```

---

## 3. Mobile app build & release (EAS)

### 3.1 Environment

`apps/mobile/.env.local` (never committed) — points the app at production:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

EAS builds read these from EAS **environment variables** (dashboard or
`eas env:create`), not the local file.

### 3.2 Build profiles (`apps/mobile/eas.json`)

| Profile | Use |
|---|---|
| `development` | dev client for on-device debugging (push testing needs this, not Expo Go) |
| `preview` | internal distribution build for pre-release validation |
| `production` | store build; `autoIncrement` bumps the build number |

```bash
cd apps/mobile
eas build --profile production --platform android
eas build --profile production --platform ios      # when iOS ships
eas submit --profile production --platform android  # after the build succeeds
```

### 3.3 Android specifics (already declared in `app.json`)

- Notification channel `medications` (`IMPORTANCE_MAX`) and `alerts`
  (`HIGH`) are created at runtime (`setupNotificationChannels`).
- Permissions incl. `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`,
  `SCHEDULE_EXACT_ALARM` — required for lock-screen reminders. Do not remove.

---

## 4. Dependency-audit posture (triaged M11)

CI runs `npm audit --omit=dev --audit-level=high` (job **Dependency Audit**),
currently **non-blocking**. Triage as of this release:

- The remaining advisories are **transitive build-toolchain** dependencies
  pulled in under `expo` / `react-native` / `@expo/cli` / metro (e.g. `ws`,
  `tar`, `js-yaml`) — they run at build/dev time and are **not shipped in the
  production app bundle**.
- A non-breaking `npm audit fix` clears the critical (`shell-quote`) and one
  high (`undici`); the remaining high (`ws` in the dev bundler) only clears
  with a **breaking Expo SDK upgrade** (`expo@57`), which is a deliberate,
  separately-validated change — not a hotfix.
- **Recommendation:** at the next planned Expo SDK bump, run `npm audit fix`,
  re-verify the full gate + a device smoke, then flip the CI job to blocking
  (`--audit-level=critical` at minimum). Until then it stays reporting-only so
  a transitive dev advisory can't block an unrelated release.

---

## 5. Release checklist

1. All local gates green: `npm run typecheck`, `npm run lint`, `npm test`,
   `npm run db:reset`, `npm run db:test`, and `deno test tests/` in
   `supabase/functions/`.
2. CI green on the PR (all 8 jobs).
3. **Physical-device validation pass** (the one manual gate): reminder loop
   incl. killed-app cold start; confirm → caregiver dashboard update; urgent
   message → popup → receipt; **airplane-mode confirm → reconnect → syncs with
   the original tap time** (M11 outbox); Hebrew + RTL restart; a11y profile
   (font scale ≥1.3, TalkBack) in Hebrew.
4. Promote `develop → main` (PR), tag the release.
5. Backend deploy (§2) against the production project, then EAS build/submit
   (§3).

---

## 6. Incident & rollback

- **App-level render crash:** caught by the global ErrorBoundary (M11) — the
  user sees a localized recovery screen, not a white screen. Check crash logs.
- **Session rejected (401 storm):** the global 401 handler (M11) signs the user
  out once and routes to login. If widespread, suspect a rotated key — see
  below.
- **Rotating the `service_role` key:** rotate in Supabase, then update **both**
  the DB GUC (`ALTER DATABASE ... SET app.service_role_key`) and the Edge
  Function secret, and redeploy functions. The anon key rotation additionally
  requires a new mobile build.
- **Bad migration:** never `DELETE`/rollback `medication_events`. Fix forward
  with a new migration. Schema rollback is only safe for objects with no data
  dependence (views, functions, indexes).
- **Duplicate doses/alerts:** the `UNIQUE(schedule_id, scheduled_time)` and
  `UNIQUE(caregiver_id, event_id, alert_type)` constraints make the pipeline
  idempotent. If duplicates appear, do not drop the constraints — investigate
  the scheduler/webhook instead.

---

## 7. Known limitations at this release

- Snooze does not re-schedule a server-side push (the reminder card stays
  visible until taken/missed; one push per dose via `notified_at`). A true
  "remind me in N minutes" needs scheduler support — candidate for a later
  milestone.
- `notifications_sent` counts successful `send-push` **calls**, not confirmed
  device deliveries (Expo receipts are not yet polled).
- Remaining M11 release-prep not in this runbook's scope: he/en user manuals
  for the patient/caregiver, a chaos-test script, and the full Maestro suite as
  an automated release gate.
