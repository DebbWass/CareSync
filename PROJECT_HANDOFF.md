# CareSync — Project Handoff

**Snapshot date:** 2026-07-08
**Branch state:** `develop` = M0–M10 merged (M5=#15, M7=#16, M6=#18, M8=#19, M9=#20, M10=#21); M11 offline-resilience core on `feature/m11-offline-resilience` (PR pending)
**Overall completion: ~92%** of the production-rebuild scope (M0–M10 done; M11 resilience code complete, M11 release-prep + device validation remain)
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

- [x] **M5 — Patient reminder experience** (PR #15, MERGED — device-validation
      tail remains, see Remaining). Fixed the `snoozeEvent` read-then-increment race with
      a `snooze_event(uuid)` RPC (SECURITY INVOKER single-UPDATE increment,
      status-guarded, pgTAP-covered; migration 20260707000002). Optimistic
      confirm/snooze with rollback in `useMedicationEvent` (hook tests cover
      optimistic + rollback + null-RPC-result paths). All four patient
      surfaces hardened: i18n (`patient.*` namespace), ErrorBanner with retry,
      design-system Text/Button (font-scale aware), theme-aware deep-link
      screen, localized tab labels. Button + ErrorBanner made high-contrast
      aware (were hardcoded to the light palette). Maestro: new
      `05_patient_confirm_medication.yaml`; fixed flow 02 missing tab-nav step.
      **REMAINING (user actions, after M7 merges):** EAS dev build on a
      physical Android device; validate cron → push → tap → confirm → caregiver
      update incl. killed-app cold start; father's device-profile checkpoint
      (font scale ≥1.3, TalkBack). Use a build that includes M7 — its
      AuthGuard fix is required for the cold-start push→tap path.

- [~] **M7 — Auth hardening** (feature/m7-auth-hardening — CODE COMPLETE,
      PR #16 open; develop, including M5, already merged in). Minimum password 8
      (config.toml + `MIN_PASSWORD_LENGTH` client validation); forgot/reset
      password flow: `(auth)/forgot-password` + standalone `app/reset-password`
      deep-link target (`caresync://reset-password`, implicit-flow fragment
      tokens parsed by `parseRecoveryUrl` — RN URLSearchParams is unreliable);
      GoTrue error codes mapped into the AppError contract
      (invalidCredentials/emailInUse/weakPassword/samePassword/rateLimit/
      expiredLink) so auth screens stop showing raw API strings; full i18n
      sweep of login/register (`auth.*` namespace); `getProfileWithRetry`
      fixes the fresh-signup bounce; AuthGuard now allowlists standalone
      routes — this also fixed a latent bug where the guard bounced the
      `/reminder/[eventId]` push deep link back to home. +11 Jest tests.
      **REMAINING (user actions):** review/merge the PR; reset-email delivery
      on the hosted stack uses Supabase's built-in SMTP (fine for dev; custom
      SMTP is an M11/production item).

- [x] **M6 — Hebrew + RTL + language switcher** (MERGED via PR #18; the
      original #17 was merged into the wrong target — the already-merged M7
      branch — and never reached develop). Full `he.json` (elderly-simple
      Hebrew); en/he key-parity Jest
      test (incl. plural-suffix normalization and {{placeholder}} parity);
      first-ever Settings UI (patient 3rd tab + caregiver header gear):
      language switcher (device/עברית/English), high-contrast toggle and
      text-size stepper (store settings existed but had NO UI until now —
      closed a non-negotiable gap); switching writes settingsStore +
      users.language (scheduler push copy) + i18n; RTL direction change
      applies I18nManager.forceRTL immediately and OFFERS a restart
      (declining is safe — applies next launch); date-fns-based locale-aware
      date/time helpers (Hebrew = 24h clock, "7 ביולי"); DAY_LABELS →
      i18n keys, FREQUENCY_LABELS deleted (was test-only); caregiver tab
      labels localized (were hardcoded); RTL style audit (start/end
      geometry, direction-aware chevrons/arrows via utils/rtl.ts).
      **REMAINING (user action):** verify the RTL flip on a real device
      (forceRTL needs a dev build, not Expo Go).

- [x] **M8 — Urgent messaging: data layer** (PR #19, MERGED).
      `messages` table: pair + sender + body, `UNIQUE(sender_id, client_id)`
      idempotency (offline-outbox retry → 23505-as-success), monotonic
      receipts sent→delivered→read with server-set timestamps
      (trigger-enforced; read implies delivered), body/identity immutable,
      DELETE blocked even for service_role. RLS: active-relationship-only
      sending, no sender forgery, recipient-only receipts. Realtime
      publication + REPLICA IDENTITY FULL. AFTER INSERT webhook →
      message-push Edge Fn (localized, NO-PHI push: {type:'message',
      message_id}; patient recipients get the MAX 'medications' channel).
      14 pgTAP + 6 Deno tests. **Critical M9 gotcha VERIFIED LIVE**
      (`npm run verify:realtime`): postgres_changes DOES deliver to
      RLS-constrained users, BUT ONLY if the client calls
      `realtime.setAuth(token)` before subscribing — without it the socket
      joins as anon and events are silently withheld. M9's RealtimeProvider
      must do this.

- [x] **M9 — Urgent messaging: client** (PR #20, MERGED). `messages` service
      (23505-as-success = the
      duplicate IS the success), persisted offline outbox (Zustand +
      AsyncStorage; entry saved with its client_id BEFORE the first network
      attempt — crash-safe exactly-once; exponential backoff, permanent
      failures dropped, NetInfo reconnect flush via useOutboxFlusher);
      RealtimeProvider honoring the verified setAuth rule (re-runs setAuth +
      resubscribes on every token change; also made the caregiver alert
      inbox live — closed the backlog item); patient fullscreen popup
      `app/message/[messageId].tsx` (elderly a11y: one message, one 80dp
      GOT-IT button; viewing = delivered, acknowledging = read); caregiver
      thread `(caregiver)/messages/[patientId]` (compose, receipt ticks
      icon+text never color-only, offline banner, open-marks-read); dashboard
      patient-card 💬 entry; tap handler + AuthGuard route 'message' deep
      links; en+he strings (parity-tested). +11 Jest tests.
      **REMAINING (user):** live message flow rides the same physical-device
      validation pass as M5.

- [~] **M10 — Caregiver analytics** (feature/m10-caregiver-analytics — CODE
      COMPLETE, PR pending). `adherence_stats(patient_id, days)` RPC: buckets
      resolved doses by `(scheduled_time AT TIME ZONE users.timezone)::date`
      (patient-local day, so a 23:30 local dose files under the right day, not
      its UTC day), denominator = taken + missed only (pending/snoozed are
      unsettled — a dose due tonight is not a miss). SECURITY INVOKER, so RLS
      constrains it to the caller's patients (arbitrary id → no rows); no new
      read surface. Client: `analytics` service (getAdherenceStats +
      summarizeAdherence, whose `percent` is nullable → UI shows "no data", not
      a misleading 0%), `useAdherence` hook (per-domain key factory), shared
      `adherenceTone` util (good/fair/poor thresholds + icons, never
      color-only). UI: dashboard patient-card adherence badge (fetches its own
      window, links through) + new per-patient trends screen
      `(caregiver)/patients/[patientId]` — headline % + per-day bar trend built
      from **plain Views on purpose** (a real chart library stays a UI
      checkpoint for the owner). `formatShortDay` parses bare YYYY-MM-DD as a
      local date (no UTC shift). en+he `analytics.*` (parity-tested). 8 pgTAP
      (incl. the midnight-edge proof) + 7 Jest. Verified against seed →
      85.7% (18/21). **REMAINING (user):** review/merge the PR; the chart-library
      decision if richer visuals are wanted (deliberately deferred).

- [~] **M11 — Offline resilience** (feature/m11-offline-resilience — CODE
      COMPLETE for the resilience half; release-prep half remains). Four
      hardening pieces for a phone in an elderly person's pocket: (1)
      **onlineManager ← NetInfo** — React Query now pauses queries offline and
      resumes on reconnect instead of firing into a dead network
      (`src/lib/onlineManager.ts`, wired in the root layout before any query);
      (2) **global 401 recovery** — a server-rejected session (password change
      elsewhere, revoked token, key rotation) surfaces as AppError('auth') and
      would loop forever; a QueryCache/MutationCache onError signs out once
      (re-entrancy guarded, only when a session exists) → AuthGuard redirects to
      login (`src/lib/authRecovery.ts` + `queryClient.ts`); (3) **error
      boundary** — a render crash no longer unmounts to a blank screen; a
      localized "Try again" recovery screen re-mounts the subtree (class
      component, Paper-free; en+he); (4) **offline confirm outbox** — the "I
      took it" tap is persisted with its tap-time `taken_time` BEFORE the first
      network attempt and replayed on reconnect, so the audit log records when
      the patient actually took the dose; `confirmEvent` gained an optional
      takenTime + a `status <> 'taken'` idempotency guard (replay never clobbers
      a taken_time), `useConfirmEvent` enqueues on network error (non-network
      still rolls back), both outboxes ride the one NetInfo flusher. No DB change
      (uses the existing table + RLS). +7 Jest. **M11 release-prep is now
      essentially built:** runbook (`docs/runbook.md`), npm audit triage +
      **gate flipped to blocking on critical** (non-breaking `npm audit fix`
      applied; full gate + `expo export` re-verified green), `npm run chaos`
      smoke, English + **Hebrew** user-guide drafts (`docs/user-guide.md` +
      `docs/user-guide.he.md`), explicit EAS production store profile + release
      steps, and the Maestro release suite (`.maestro/README.md` + adherence
      flow). **What TRULY REMAINS is execution the owner must do:** run the EAS
      production build/submit (needs real credentials); personalise + approve the
      user-guide drafts (esp. Hebrew/patient wording); device-validate the
      Maestro flows; and the Expo SDK 54→57 bump (clears the last `ws` high and
      lets the audit threshold rise to `high`) — deliberately deferred, needs
      device validation, NOT a hotfix.

- [x] **M11 — Auth & i18n polish (2026-07-22, from device testing).** Six
      user-reported fixes on `feature/m11-release-prep-final`:
      1. **Missing tab/header icons** — switched `react-native-vector-icons`
         (fonts never bundle in Expo managed) to `@expo/vector-icons` in both
         `(caregiver)/_layout.tsx` and `(patient)/_layout.tsx`; the MCI font now
         embeds (verified via `expo export`).
      2. **Wrong launch language** — i18n read `settingsStore` synchronously at
         import, before AsyncStorage rehydration, so the app locked onto the
         device language while Settings showed the saved one. Added
         `syncLanguageWithStore()` (i18n/index.ts) reconciling on
         `persist.onFinishHydration`. +3 Jest.
      3. **Remember me** — login screen checkbox + `settingsStore.rememberedEmail`
         pre-fill (session already persists via SecureStore). +1 Jest.
      4. **Unique email** — `signUp()` now also rejects GoTrue's empty-`identities`
         anti-enumeration response, so "email already in use" shows regardless of
         the *Confirm email* setting. Live-verified on local. +2 Jest.
      5. **Account-not-found on reset** — new `email_exists(text)` SECURITY DEFINER
         RPC (anon-granted); forgot-password checks it first and shows an explicit
         message. **Deliberately reverses anti-enumeration — an explicit owner
         decision.** RPC live-verified (true/false/case-insensitive). +3 Jest.
      6. **Real reset emails (SMTP)** — code/flow ready and verified (reset email
         generated, captured by local Mailpit). Real delivery is owner-executed:
         SMTP runbook added to `docs/deployment.md` (Step 6). **REMAINS:** enter
         the SMTP API key in the hosted dashboard, push migrations to hosted, add
         the `caresync://reset-password` redirect URL.
      7. **Invite-patient by email failed** — `users_select` RLS hides patients a
         caregiver isn't linked to yet, so the invite lookup always reported "no
         patient found". Added `find_patient_id_by_email(text)` SECURITY DEFINER
         RPC (authenticated) and routed `invitePatientByEmail` through it. Live-
         verified against the real local accounts (patient→id, caregiver→null,
         case-insensitive).
      8. **Patient couldn't see/accept invitations + no way to disconnect** —
         invitations are in-app (no email), but the patient app had no surface to
         act on them, and `users_select` RLS hid the inviting caregiver. Added
         `get_patient_invitations()` SECURITY DEFINER RPC (returns pending invites
         + caregiver name/email), a patient-home invitation card (Accept/Decline),
         a caregiver **Cancel** button for pending invites, and made
         `invitePatientByEmail` revive a cancelled/revoked link instead of failing
         on the unique constraint (so cancel→re-invite works; an already-active
         link still reports conflict). Accept/decline/cancel ride existing
         `relationships_update` RLS. Live-verified the whole lifecycle
         (invite→see→accept, cancel, re-invite). +7 Jest.

**Test totals (develop + M11 branch):** 170 Jest · 31 Deno · 77 pgTAP ·
8 CI jobs.

## Remaining Features (prioritized roadmap)

### High priority — required for production

- [ ] **M5 — validation tail** (M5 merged; see Completed section). Entirely
      user-in-the-loop: EAS dev build on a physical Android device, validate
      push→tap→confirm end-to-end including killed-app cold start, and the
      father's device-profile checkpoint (font scale, TalkBack). Build must
      include M7 (AuthGuard deep-link fix).
- [ ] **M6 — RTL spot-check** (merged): flip to Hebrew in Settings on a dev
      build and confirm the restart + mirrored layout.
- [ ] **M10 — review tail** (code complete, see Completed section): review
      and merge the M10 PR. Optional user checkpoint: whether to adopt a chart
      library for richer adherence visuals (the shipped trend is dependency-free
      by design).
- [~] **M11 — Offline resilience + release prep.** Resilience half DONE (see
      Completed): onlineManager ← NetInfo, global error boundary, 401 path,
      offline confirm outbox. Release-prep started: **`docs/runbook.md`** (the
      authoritative production deploy + incident runbook), the **npm audit
      triage** (see below), and **`npm run chaos`** (`scripts/chaos.mjs` —
      abuses the PostgREST surface to prove idempotent dose generation,
      audit-log immutability even for service_role, message exactly-once and
      alert dedup all hold; verified green locally) are done. **Release-prep
      half is now essentially built** (runbook, audit triage + gate flip to
      blocking-on-critical, chaos smoke, English + Hebrew user-guide drafts, EAS
      store profile + steps, Maestro release suite). What TRULY remains is
      owner-executed: the EAS production build/submit (real credentials),
      personalising/approving the user guides, device-validating the Maestro
      flows, and the Expo SDK 54→57 bump (deferred; needed to raise the audit
      threshold to `high`). Complexity: **Low** (only execution left).
      - **npm audit (recorded in runbook §4):** the CI Dependency Audit job now
        **blocks on critical** (0 after the non-breaking fix) and reports
        high/moderate. The remaining high/moderate advisories are transitive
        **build-toolchain** deps (`ws`/`tar`/`js-yaml` via metro/dev-middleware)
        — not in the shipped bundle. The applied non-breaking `npm audit fix`
        (lockfile only) cleared the critical + one high; the last `ws` high needs
        a breaking **Expo SDK bump** (`expo@57`), after which raise the gate
        threshold from `critical` to `high`. Do NOT run `npm audit fix --omit=dev`
        — it prunes devDependencies (jest/@types) and breaks the toolchain
        (verified this session; reverted).

### Medium priority

- [x] **M10 — Caregiver analytics** (code complete on
      `feature/m10-caregiver-analytics`; see Completed section). Delivered the
      `adherence_stats` RPC + dashboard adherence % + per-patient trends screen.
      A chart library was deliberately NOT added — that remains a user checkpoint.
- [ ] Add a language-switch Maestro flow (settings → עברית → restart prompt).
      Complexity: **Low**.
- [x] Realtime for the caregiver inbox — done in M9's RealtimeProvider (it also
      subscribes the alert inbox; `realtime.setAuth` honored).

### Low priority / cleanup

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

1. `docs/` other than db-schema.md and notification-flow.md are partly stale.
2. GitHub Actions once silently dropped a workflow run for a pushed commit
   (PR #9 fix commit) — if CI seems missing, check `gh run list` before
   assuming success.
3. Jest full-suite runs on Windows sometimes print "worker process has failed
   to exit gracefully"; `--detectOpenHandles` finds nothing, all tests pass,
   and subsets run clean — treated as a flaky local artifact; watch CI.
4. Snoozing does not schedule a re-push server-side: the chosen snooze
   minutes are UI-only today (the scheduler pushes once per dose via
   `notified_at`). The reminder card stays visible until taken/missed, which
   is honest UX, but a true "remind me again in N minutes" needs scheduler
   support — candidate for M11 scope discussion.

Resolved this session: the `snoozeEvent` read-then-increment race (atomic
RPC), patient screens bypassing a11y/i18n/ErrorBanner patterns, the stale
Maestro flow 02 (missing Medications-tab navigation step), the fresh-signup
profile bounce (retry in M7), the AuthGuard bouncing standalone deep-link
routes (`/reminder/[eventId]`, `/reset-password`), and raw GoTrue error
strings on the auth screens.

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

Sessions of 2026-07-07/08 delivered M5 (#15), M7 (#16), M6 (#18 after the
mis-targeted #17), M8 (#19), M9 (#20), M10 (#21) — all MERGED — and the M11
offline-resilience core (`feature/m11-offline-resilience`, PR pending). One
open milestone PR at a time from here on (the doc-conflict lesson). All 11
milestones now have code; what remains is the M11 release-prep half
(audit-blocking, chaos script, manuals, EAS prod profile, Maestro release
gate) and the physical-device validation pass.

## Next Recommended Tasks (in order)

1. **User: review + merge the M11 PR** (offline-resilience core).
2. **User: EAS dev build** on a physical Android device; one validation
   pass covering everything shipped: cron → push → tap → fullscreen
   reminder → confirm → caregiver dashboard update incl. killed-app cold
   start; caregiver sends an urgent message → patient popup → GOT IT →
   receipt turns "read"; airplane-mode send → reconnect → auto-delivery;
   Hebrew switch + RTL restart in Settings; the new adherence badge/trends
   screen; father's device profile (font scale ≥1.3, TalkBack) — in Hebrew.
   Also exercise the new resilience layer: airplane-mode confirm → reconnect →
   the dose syncs with its original tap time.
3. Then the **M11 release-prep** follow-up PR (audit-blocking, chaos script,
   he/en manuals, EAS production profile, Maestro release gate). Consider a
   develop→main promotion once the device validation passes.

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
