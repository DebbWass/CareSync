# CareSync — Project Handoff

**Snapshot date:** 2026-07-07
**Branch state:** `develop` = milestones M0–M4 merged (PRs #6–#12); promotion PR #13 (`develop` → `main`) open
**Overall completion: ~45%** of the production-rebuild scope (5 of 12 milestones done)
**Project health: GOOD** — every merged milestone passed an 8-job CI gate; no known broken flows in merged code

> This file is the single source of truth for project status. **Update it at the
> end of every significant development session.** The full milestone plan lives
> in the session plan file (see "Roadmap source" below); this document is the
> repo-resident summary.

---

## Project Overview

CareSync is a healthcare mobile app for Alzheimer's/elderly medication
management, built by Debra for her father, who has early-stage Alzheimer's and
lives alone in Israel. One Expo/React Native app serves two roles: the
**patient** receives fullscreen medication reminders and confirms/snoozes
doses; the **caregiver** manages medications and schedules remotely and
receives alerts when doses are missed.

The project is mid-way through a deliberate production rebuild executed as 12
strict milestones (M0–M11), each delivered as a reviewed, CI-green PR into
`develop` with periodic promotions to `main`. Milestones M0–M4 are complete:
git-history reconciliation, database consolidation, quality-gate tooling,
data-layer error normalization, and notification-pipeline hardening. The next
milestone (M5) is the patient-facing reminder experience — the core product
loop.

**Non-negotiable product rules** (enforced in code, preserve them):

1. Push notification payloads NEVER contain PHI (medication names, dosages,
   patient names) — only opaque IDs (`event_id` / `alert_id`).
2. `medication_events` is an immutable audit log — no DELETE ever; UPDATE only
   on `status`, `taken_time`, `snooze_count`, `notes`, `notified_at`
   (trigger-enforced, binds even `service_role`).
3. The `service_role` key exists only in Edge Functions; the mobile client
   uses the anon key constrained by RLS.
4. Elderly accessibility on patient screens: ≥24sp body text, 48sp medication
   name, 80dp confirm button, `accessibilityLabel`+`Hint` everywhere,
   high-contrast support, never color-only state.
5. Auth session tokens live in SecureStore (chunked), never plaintext
   AsyncStorage.

---

## Current Architecture

```
┌─ apps/mobile (Expo SDK 54, TypeScript, Expo Router) ─────────────────┐
│ app/ (auth)|(patient)|(caregiver) route groups + reminder/[eventId]  │
│   Root _layout: i18n init → QueryClientProvider → PaperProvider     │
│   → AuthGuard (session-ready gate, role redirect) + notification    │
│     tap handler (data.type: 'reminder'|'alert')                     │
│ Screens NEVER import supabase directly (ESLint-enforced) — they use │
│   hooks (src/hooks/use*) → services (src/services/supabase/*)       │
│   → typed client (createClient<Database>)                           │
│ Services throw AppError {code, messageKey}; screens render          │
│   <ErrorBanner error onRetry/> (localized, a11y-announced)          │
└──────────────────────────────────────────────────────────────────────┘
                    │ anon key + RLS
┌─ Supabase ────────────────────────────────────────────────────────────┐
│ Postgres 17: 7 tables, 22 RLS policies, is_caregiver_for() helper,   │
│   immutability triggers, alert-dedup unique index, realtime pub      │
│   (alerts, medication_events), explicit role GRANTs                  │
│ pg_cron (*/5min) ──HTTP──▶ medication-scheduler Edge Fn:             │
│   patient-local wall clock → UTC (luxon, users.timezone), idempotent │
│   event upsert, missed marking (30-min grace), one push per dose     │
│   (notified_at), localized copy (users.language)                     │
│ AFTER UPDATE trigger on medication_events ──pg_net──▶ caregiver-alert│
│   Edge Fn: dedup'd alert fanout + caregiver pushes ('alerts' channel)│
│ send-push Edge Fn: Expo Push API, batch 100, 3-attempt backoff,      │
│   token validation, DeviceNotRegistered pruning                      │
│ Runtime config: GUCs app.supabase_url / app.service_role_key         │
│   (ALTER DATABASE ... SET; safe no-op until configured)              │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow (reminder loop):** cron → scheduler creates `medication_events`
(pending) → push to patient (`{type:'reminder', event_id}`) → tap deep-links
to `/reminder/[eventId]` → confirm sets `status='taken'` / snooze increments →
missed/snooze-limit transition fires webhook → alerts row per caregiver →
caregiver push (`{type:'alert', ...}`) → alert inbox.

## Technology Stack

| Layer | Tech | Version |
|---|---|---|
| Mobile | Expo (managed) / React Native / React | SDK 54 / 0.81.5 / 19.1.0 |
| Language | TypeScript (strict) | 5.9 |
| Navigation | Expo Router (typed routes) | 6.x |
| Server state | TanStack Query | 5.x |
| Client state | Zustand (persist) | 5.x |
| UI | React Native Paper + custom design system | 5.15 |
| i18n | i18next + react-i18next + expo-localization | en live, he pending (M6) |
| Backend | Supabase (Postgres 17, RLS, Realtime, Edge Functions/Deno, GoTrue) | CLI ≥2.98 |
| Edge date math | luxon (npm: specifier in Deno) | 3.x |
| Push | Expo Push API → FCM/APNs | — |
| Tests | Jest (jest-expo) + @testing-library/react-native; Deno test; pgTAP (`supabase test db`); Maestro (E2E, local) | — |
| CI | GitHub Actions, 8 jobs | — |
| Build | EAS (project ID in app.json; dev build required for push testing) | — |

## Repository Structure

```
apps/mobile/
  app/                    Expo Router screens: (auth), (patient), (caregiver), reminder/
  src/components/ui/      Button (a11y, 48/80dp), Text (fontScale/contrast), ErrorBanner
  src/components/patient/ ReminderCard (pre-rebuild quality — M5 hardens it)
  src/services/supabase/  auth, medications, schedules, events, alerts, patients, errors
  src/hooks/              useAuth (listener+isReady), useMedications, useSchedules,
                          useMedicationEvent, useAlerts, usePatients (TanStack Query + key factories)
  src/store/              authStore (SecureStore-persisted), settingsStore (a11y prefs + language)
  src/i18n/               index.ts (detection: setting→device→en) + locales/en.json
  src/types/              index.ts (domain, snake_case = DB rows), database.ts (GENERATED — npm run db:types)
  src/services/notifications/  registration.ts (token lifecycle), channels.ts (Android channels)
  .maestro/               4 E2E flows (local only; some button text may be stale)
supabase/
  migrations/             8 files: consolidated 01-07 set + 20260707 notified_at
  functions/              medication-scheduler (index+logic), send-push, caregiver-alert,
                          _shared/ (retry, localization), tests/ (25 Deno tests), deno.json
  tests/                  pgTAP: schema, RLS matrix, triggers (47 assertions)
  seed/seed.sql           deterministic dev data (accounts below)
docs/                     db-schema.md + notification-flow.md are v2/current; others predate rebuild
scripts/                  invoke-scheduler.mjs (npm run scheduler:run), maestro-install.sh
.github/workflows/ci.yml  8-job quality gate
```

**Local dev loop:** `supabase start` → `npm run db:reset` → `npm start`.
Seed accounts: `patient@caresync.test` / `caregiver@caresync.test`, password
`Password123!`. Root scripts: `test`, `lint`, `typecheck`, `db:reset`,
`db:test`, `db:types`, `scheduler:run`.

**Roadmap source:** the 12-milestone plan was approved in-session (plan file
`caresync-complete-greedy-fern.md` under the user's Claude plans directory);
the milestone list below is the durable copy.

---

## Completed Features (M0–M4)

- [x] **M0 — Baseline reconciliation** (PRs #6, #8). Merged two divergent
      histories (remote "Phases 2–8 rebuild" vs local WIP) file-by-file.
      Complete; no debt. Pre-merge WIP preserved on `wip/pre-rebuild-snapshot`.
- [x] **M1 — Database consolidation** (PR #7). 7-migration clean set; added
      `users.timezone` + `users.language`; immutability triggers; alert-dedup
      index `(caregiver_id, event_id, alert_type)`; realtime publications;
      cron/webhook as version-controlled trigger + pg_net; deterministic seed
      (85.7% adherence, hand-verifiable); pgTAP suite; generated `database.ts`
      + typed client (immediately caught 2 ambiguous-embed query bugs).
      Complete. Debt: none known.
- [x] **M2 — Quality gates** (PRs #9, #10). CI 2→8 jobs; Jest 58→78 tests;
      global jest.setup; Prettier; i18n scaffold (en) with tested detection
      precedence; ESLint rule barring `lib/supabase` imports under `app/`;
      removed legacy zustand CJS shim. The pgTAP CI job caught missing role
      GRANTs on its maiden run (fixed in #10). Complete.
- [x] **M3 — Data-layer error normalization** (PR #11). `AppError` +
      `normalizeSupabaseError()` (network/auth/permission/notFound/conflict/
      unknown → i18n keys); all 5 services THROW instead of silently returning
      empty; `<ErrorBanner/>`; all 9 caregiver screens swept (error states +
      ~90 strings to en.json). Deliberate deviation: kept snake_case domain
      types (typed client already provides safety; camelCase mappers judged
      churn). Complete for caregiver side; patient screens intentionally
      deferred to M5.
- [x] **M4 — Notification pipeline hardening** (PR #12). Fixed 4 production
      bugs: UTC-vs-local dose times (now luxon + `users.timezone`, DST-pinned
      tests), duplicate pushes per cron run (new `notified_at`), payload
      `data.type` mismatches that broke tap-navigation ('reminder'/'alert'),
      wrong Android channel for caregiver alerts. Added send-push retry/backoff
      + token validation, exactly-once alert fanout (pushes only for
      newly-created alert rows), he/en notification copy, index/logic split,
      25 Deno tests, `npm run scheduler:run`. **Verified live** on the local
      stack including a webhook-replay dedup proof. Complete.

**Test totals on develop:** 78 Jest · 25 Deno · 47 pgTAP · 8 CI jobs green.

## Remaining Features (prioritized roadmap)

### High priority — required for production

- [ ] **M5 — Patient reminder experience** (THE core loop). Harden
      `app/(patient)/index.tsx`, `app/reminder/[eventId].tsx`,
      `app/(patient)/history.tsx`, `src/components/patient/ReminderCard.tsx`
      to design-system + elderly-a11y standards (48sp med name, 80dp confirm,
      snooze-limit UX, ErrorBanner, `t()` strings); optimistic confirm/snooze
      with rollback; **fix the `snoozeEvent` read-then-increment race**
      (`src/services/supabase/events.ts` — make atomic, e.g. RPC);
      validate push→tap→confirm end-to-end on a **physical EAS dev build**
      including killed-app cold start. Depends on: EAS login/build (user
      action). Complexity: **High**. Ends with the user verifying on her
      father's device profile (font scale, TalkBack).
- [ ] **M6 — Hebrew + RTL + language switcher.** Full `he.json` (elderly-simple
      Hebrew — user reviews copy); switcher writes settingsStore + `users
      .language`; `I18nManager.forceRTL` + `Updates.reloadAsync` flow; RTL
      style audit (marginStart/End, textAlign:'auto', icon flips); localize
      dates + `DAY_LABELS` (currently English in `src/utils/scheduleUtils.ts`);
      en/he key-parity test. Files: every screen (styles only), i18n/, layouts.
      Depends on M5 (so patient screens exist to translate). Complexity: **High**.
- [ ] **M7 — Auth hardening.** Min password 8 (currently 6 in
      `supabase/config.toml`), forgot/reset-password screens + deep link,
      localized errors. Complexity: **Medium**.
- [ ] **M8+M9 — Urgent patient↔caregiver messaging.** New `messages` table
      (client_id idempotency, monotonic sent→delivered→read trigger, RLS,
      realtime publication, INSERT webhook → new message-push Edge Fn);
      RealtimeProvider; persisted offline outbox (Zustand + NetInfo, backoff,
      23505-as-success = exactly-once); patient fullscreen popup
      `app/message/[messageId].tsx`; caregiver compose + receipts. The design
      is fully specified in the approved plan. Complexity: **High**.
      Critical gotcha to verify early: postgres_changes delivery WITH RLS
      enabled.
- [ ] **M11 — Offline resilience + release prep.** TanStack onlineManager ←
      NetInfo; global error boundary; 401 path; offline confirm outbox
      (record `taken_time` at tap time); flip `npm audit` CI job to blocking;
      chaos-test script; runbook + user manuals (he/en); EAS production
      profile; full Maestro suite as release gate. Complexity: **High**.

### Medium priority

- [ ] **M10 — Caregiver analytics.** `adherence_stats` SQL view/RPC with
      `AT TIME ZONE users.timezone` day bucketing (midnight-edge pgTAP test);
      dashboard adherence % + trends; per-patient history screen. User
      checkpoint before adding any chart library. Complexity: **Medium**.
- [ ] Refresh Maestro flows against current screen text (audit found at least
      one stale button label) and add reminder-confirm + language-switch flows.
      Complexity: **Low**.
- [ ] Profile-bootstrap resilience: `useAuth` signs the user out if
      `getProfile` returns null; a slow `handle_new_user` trigger right after
      signup could bounce a fresh user. Add a short retry. Files:
      `src/hooks/useAuth.ts`. Complexity: **Low**.
- [ ] Realtime for the caregiver inbox (publications exist since M1; no client
      subscription yet — currently refetch-on-focus). Arrives naturally with
      M9's RealtimeProvider. Complexity: **Low** once M9 lands.

### Low priority / cleanup

- [ ] Deduplicate frequency/day labels: `FREQUENCY_LABELS` in
      `scheduleUtils.ts` now overlaps `schedules.frequency.*` i18n keys —
      remove the constant after M6 localizes `DAY_LABELS`. **Low**.
- [ ] `(patient)/_layout.tsx` tab labels ("Today"/"History") are still
      hardcoded English — fold into M5/M6 sweep. **Low**.
- [ ] Update `CLAUDE.md` (still describes the pre-rebuild "7 phases"; commands
      and schema sections need a refresh; add: read PROJECT_HANDOFF.md first).
      Also refresh `docs/architecture.md`, `docs/api-reference.md`,
      `docs/deployment.md` (predate the rebuild). **Low**.
- [ ] `notifications_sent` in scheduler/caregiver-alert counts successful
      send-push *calls*, not device deliveries — rename or track both. **Low**.
- [ ] `console.error` debug line remains in `(auth)/register.tsx` and
      `auth.ts` (lint-allowed but noisy). **Low**.
- [ ] Consider Expo push *receipt* polling (tickets are checked; receipts —
      delivered-to-device — are not). **Low** until real-device soak testing.

## Known Issues

1. `snoozeEvent` race (read-then-increment) — two rapid snoozes could lose a
   count. Fix scheduled for M5 (atomic RPC).
2. Patient screens don't yet meet the elderly-a11y spec and bypass the
   ErrorBanner/i18n patterns (pre-rebuild code, M5 scope).
3. Fresh-signup bounce possibility if profile trigger lags (see Medium item).
4. Maestro flow 02 references a stale button label.
5. `docs/` other than db-schema.md and notification-flow.md are partly stale.
6. GitHub Actions once silently dropped a workflow run for a pushed commit
   (PR #9 fix commit) — if CI seems missing, check `gh run list` before
   assuming success.

## Technical Debt

Deliberately small. The notable items: label-source duplication
(scheduleUtils vs i18n), stale legacy docs, `getPendingEvent`'s null contract
(legitimate "no dose" — documented in code, keep it), and seed/test
credentials being well-known strings (dev-only by design; never reuse in
prod). The `wip/pre-rebuild-snapshot` and old `claude/*` branches can be
pruned once the team is confident nothing else needs salvage.

## Important Design Decisions (preserve these)

1. **Milestone discipline**: one PR per milestone into `develop`, all 8 CI
   jobs green, docs updated, completion notes in the PR body; periodic
   `develop`→`main` promotions.
2. **Domain types mirror DB rows (snake_case)** — no camelCase mapping layer;
   the generated `Database` type provides safety. Regenerate `database.ts`
   (`npm run db:types`) after every migration change.
3. **Errors**: services throw `AppError` with i18n `messageKey`; UI renders
   via `ErrorBanner`/`t()`. Never `Alert.alert(rawError.message)`; never
   swallow-and-return-empty.
4. **All user-facing strings через `t()`** with namespaced keys in
   `src/i18n/locales/`; enum-valued labels keyed by enum value
   (`alerts.type.missed`) so Hebrew is translation-only.
5. **times_of_day is patient-local wall clock**; only the scheduler converts
   to UTC (luxon, `users.timezone`). Never do timezone math client-side for
   event generation.
6. **Notification payload contract**: `data.type` ∈ {'reminder','alert'} (and
   'message' in M9), IDs only; patient channel `medications` (MAX), caregiver
   channel `alerts` (HIGH). The app's tap handler in `app/_layout.tsx` routes
   on exactly these.
7. **Migrations are append-only from now on** (the one-time consolidation was
   allowed because the DB was dev-only with no real data).
8. **DB webhooks/cron via version-controlled trigger + pg_net GUCs**, not
   Dashboard-managed hooks; environment wiring documented in
   docs/notification-flow.md.
9. Dev-quality bar: quality over speed; never proceed past a red gate.
10. UI/UX approval checkpoints belong to the user: Hebrew copy, palette,
    chart library, anything patient-facing visual.

## Coding Standards

TypeScript strict; Prettier (single quotes, 100 cols, semi, es5 commas) —
`npm run format`; ESLint zero-warnings policy (`--max-warnings 0`);
`no-console` except warn/error; screens use section-comment banners
(`// ── Section ───`); components are function declarations with typed Props
interfaces; hooks expose TanStack Query results directly (`data`, `error`,
`refetch`); query keys via per-domain factories (`medicationKeys.list(id)`);
commit style `type(scope): summary` with explanatory bodies; SQL migrations
carry rationale comments.

## Important Files

| File | Why it matters |
|---|---|
| `apps/mobile/app/_layout.tsx` | i18n init order, AuthGuard session gate, notification tap routing — most wiring lives here |
| `apps/mobile/src/services/supabase/errors.ts` | The error contract every service and screen depends on |
| `apps/mobile/src/lib/supabase.ts` + `src/types/database.ts` | Typed client; database.ts is GENERATED — never hand-edit |
| `apps/mobile/src/lib/secureStorage.ts` | Chunked SecureStore (tokens >2KB); security-sensitive |
| `supabase/migrations/20260701000003_functions.sql` | Immutability triggers + `is_caregiver_for` — the audit-log guarantee |
| `supabase/migrations/20260701000007_cron_webhooks.sql` | Cron + webhook trigger with GUC wiring |
| `supabase/functions/medication-scheduler/logic.ts` | Timezone/DST dose math — change only with its Deno tests |
| `supabase/functions/_shared/` | retry + localization shared by all functions |
| `supabase/seed/seed.sql` | Deterministic fixtures the tests and analytics math rely on |
| `.github/workflows/ci.yml` | The 8-job gate every PR must pass |
| `apps/mobile/src/i18n/locales/en.json` | Every user-facing string; he.json will mirror it |

## Current Development Status

Last session completed M4 (notification hardening, PR #12, merged) and opened
the M0–M4 promotion PR #13 (`develop`→`main`, **still open — merge it**).
Nothing is half-finished on `develop`; the tree is clean. The immediate next
work is M5.

## Next Recommended Tasks (in order)

1. Merge promotion PR #13.
2. **M5 kickoff**: fix `snoozeEvent` atomicity; harden the three patient
   screens + ReminderCard (design system, a11y spec, ErrorBanner, `t()`);
   optimistic confirm/snooze.
3. EAS dev build on a physical Android device; validate cron → push → tap →
   fullscreen reminder → confirm → caregiver dashboard update, including the
   killed-app cold-start path.
4. New Maestro flow `patient-confirm-medication.yaml`; refresh stale flows.
5. User checkpoint: demo with father's device profile (font scale ≥1.3,
   TalkBack spot-check).
6. Then M6 (Hebrew/RTL) — see roadmap above.

## Risks — do not break these

- **The immutability triggers and RLS matrix** are the healthcare-compliance
  backbone; any migration touching `medication_events` or policies must keep
  `supabase test db` green and extend the pgTAP matrix.
- **The push payload contract** is duplicated in three places by necessity
  (Edge Functions, `src/types/notifications.ts`, tap handler) — change all or
  none.
- **The scheduler's timezone semantics**: `scheduled_time` is a UTC instant
  derived from patient-local wall clock. Client code must never re-interpret
  it.
- **`UNIQUE(schedule_id, scheduled_time)` and `UNIQUE(caregiver_id, event_id,
  alert_type)`** are what make the pipeline idempotent — removing or relaxing
  them reintroduces duplicate doses/alerts.
- **i18n init order**: `import '../src/i18n'` must stay the first app import
  in the root layout, before anything calls `useTranslation()`.
- The GitHub credential used for `gh` comes from Git Credential Manager
  (`git credential fill` → `GH_TOKEN`); `gh auth login` was never run on this
  machine.
