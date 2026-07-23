# CareSync — Software Test Plan (STP)

**Document type:** Manual Test Plan
**Project:** CareSync — Medication management for Alzheimer's/elderly patients and their caregivers
**Platform:** React Native + Expo (Managed Workflow, SDK 54), Supabase backend (PostgreSQL, Auth, Realtime, Edge Functions)
**Testing type:** Manual QA only (no automated scripts produced by this document)
**Version:** 1.0
**Date:** 2026-07-23
**Status:** Draft for execution

> Companion document: [`STR.md`](STR.md) — the detailed manual test specification (individual test cases + coverage matrix). This STP defines strategy; the STR defines the executable cases.

---

## 1. Test Objectives

The testing effort validates that CareSync reliably fulfills its core mission: **an elderly patient reliably receives, understands, and confirms medication reminders, and a remote caregiver reliably sees adherence and is alerted when a dose is missed or over-snoozed.**

Concretely, testing aims to verify:

1. A patient can receive a reminder (push and in-app), read the dose details, and confirm or snooze it with large, accessible controls.
2. Confirm/snooze actions are recorded correctly, are optimistic in the UI, roll back on failure, and survive offline conditions (durable outbox with exactly-once replay).
3. The snooze limit (3) and the missed-dose grace period (30 minutes) trigger caregiver alerts exactly once.
4. A caregiver can manage medications, schedules, patients (invite/revoke), read adherence, receive alerts, and message a patient.
5. Role-based routing correctly isolates patient vs. caregiver experiences.
6. Row-Level Security (RLS) isolates each patient's data so no unrelated caregiver can read or write it.
7. `medication_events` behaves as an immutable audit log (no delete, identity columns frozen).
8. No Protected Health Information (PHI) appears in push notification payloads.
9. Accessibility requirements (font sizes, touch targets, labels, high-contrast, text scaling) are met on patient-facing screens.
10. Internationalization (English/Hebrew) and RTL behavior render correctly and localize notification copy per user.

---

## 2. Scope

### In scope

- **Mobile app (`apps/mobile`)** — all Expo Router screens for both roles:
  - Auth: login, register, logout, forgot-password, reset-password (deep link), remembered email/password pre-fill.
  - Patient: home/pending reminder, deep-link reminder screen, history, pending caregiver invitations, settings.
  - Caregiver: dashboard, medications (list/add/edit/deactivate), schedules (list/add/edit/deactivate), patients (invite/cancel/revoke), alerts inbox, per-patient adherence, messaging thread, settings.
- **Client behavior** — validation, error handling/normalization, optimistic updates and rollback, offline outbox (message + confirm), realtime updates, query polling/refetch.
- **Backend behavior testable through the client or manual API/DB tools:**
  - RLS data isolation and role-based access.
  - `medication_events` immutability (no DELETE, frozen identity columns).
  - Idempotency/uniqueness constraints (schedules, events, messages, alerts, invitations).
  - Auth trigger (`handle_new_user`) profile bootstrap.
  - RPCs: `email_exists`, `find_patient_id_by_email`, `get_patient_invitations`, `snooze_event`, `adherence_stats`.
  - Edge Functions (observed via effects/logs): `medication-scheduler` (event generation, missed marking, reminder push), `caregiver-alert` (alert + push), `send-push`, `message-push`.
- **Cross-cutting:** accessibility, i18n (en/he) + RTL, PHI-in-notification rule, session persistence.

### 3. Out of Scope

- Automated test authoring (unit/E2E/API automation) — explicitly excluded per skill mandate. Existing repo tests (Jest, Deno) are noted for reference only, not authored here.
- Load/stress/performance benchmarking beyond manual observation (NF-15/NF-16 scalability is not manually verifiable at 10k-patient scale).
- Penetration testing / destructive security testing.
- App Store / Play Store review process and store metadata.
- HIPAA/BAA legal compliance verification (organizational, not test-executable).
- Features listed as out of scope in `docs/requirements.md` §5 (voice confirmation, wearables, pharmacy integration, pill camera, video calls, dispensers, web dashboard, AI predictions).
- Real FCM/APNs delivery latency guarantees (NF-01 "within 60 seconds") — can be spot-checked manually but not guaranteed.

---

## 4. System Overview (Testing Perspective)

CareSync is a **single dual-role mobile app** backed by Supabase. After login, `authStore.role` drives routing: the root `_layout.tsx` AuthGuard redirects to `(patient)` or `(caregiver)`.

- The **patient** side is an accessibility-first reminder surface. The home screen polls every 60s for a pending/snoozed dose within the grace window and renders a fullscreen `ReminderCard` (medication name 48sp, confirm button ≥80dp). Confirm/snooze are optimistic mutations with rollback; offline confirms queue in a durable outbox and replay idempotently.
- The **caregiver** side is a management dashboard: linked patients, adherence badges, alert badge, medication/schedule CRUD, patient invitations, alert inbox, and 1:1 messaging.
- The **backend** enforces the real invariants: RLS isolates data per patient; `medication_events` is an immutable audit log; the `medication-scheduler` cron generates dose events (timezone-correct), marks overdue events missed, and sends one reminder push per event; a DB webhook fires `caregiver-alert` when a dose is missed or snooze_count reaches the limit.
- **PHI rule:** push payloads carry only IDs (event_id/message_id) — never medication/patient names.

---

## 5. Architecture Relevant to Testing

| Component | Role | Test implication |
|---|---|---|
| Expo Router (`app/`) | File-based navigation, route groups `(auth)`/`(patient)`/`(caregiver)` + deep-link routes `reminder/[eventId]`, `message/[messageId]`, `reset-password` | Test role redirects, deep-link entry, guard exceptions |
| `authStore` (Zustand) | Session + role + profile | Session persistence, restore-before-redirect |
| `settingsStore` (Zustand + AsyncStorage) | high-contrast, fontScale, reducedMotion, language, rememberedEmail | Persistence across restart; accessibility toggles |
| `outboxStore` / `confirmOutboxStore` | Durable offline queues (messages / confirms) with exponential backoff | Offline send/confirm, exactly-once, backoff, drop-on-permanent-failure |
| TanStack Query | Server state, polling (60s pending), optimistic mutations | Optimistic apply + rollback + invalidation |
| `RealtimeProvider` | Supabase Realtime subscriptions | Live thread/alert/event updates, reconnect |
| Supabase Auth (GoTrue) | JWT sessions, recovery deep link | Login/register/reset, error-code mapping |
| RLS policies | Row isolation | Cross-user access denial |
| DB triggers/functions | `handle_new_user`, `is_caregiver_for`, event immutability | Profile bootstrap, audit-log guarantees |
| Edge Functions | scheduler, caregiver-alert, send-push, message-push | Event generation, alerts, PHI-free push |
| `errors.ts` | Normalizes all failures to `AppError` codes → i18n keys | Every failure surfaces a localized message, never a silent empty list |

---

## 6. Modules and Features Under Test

| # | Module | Key features |
|---|---|---|
| M1 | Authentication | Login, register (role select), logout, session persistence, forgot-password (+ email-exists check), reset-password deep link, remembered email/password |
| M2 | Patient — Reminder | Pending event poll, ReminderCard, confirm, snooze (15/30/60), snoozes-remaining, snooze-limit state, deep-link reminder, already-taken/not-found states |
| M3 | Patient — History | Taken/missed/snoozed list, status badges, empty state |
| M4 | Patient — Invitations | Pending invite cards, accept, decline |
| M5 | Patient/Caregiver — Settings | Language (device/he/en), high-contrast, text-size stepper |
| M6 | Caregiver — Dashboard | Patient cards, adherence badge, alert badge/count, quick actions, sign out |
| M7 | Caregiver — Medications | List, add (name/amount/unit/instructions), edit, deactivate |
| M8 | Caregiver — Schedules | List, add (frequency/times/days/date range), edit, deactivate |
| M9 | Caregiver — Patients | Invite by email, revive revoked invite, cancel pending invite, revoke access, list |
| M10 | Caregiver — Alerts | List, mark read, mark all read, unread badge |
| M11 | Caregiver — Adherence | Headline %, per-day trend, no-data state |
| M12 | Messaging | Thread history, send, receipts (sent/delivered/read), mark-read, offline queue banner |
| M13 | Offline / Sync | Confirm outbox, message outbox, backoff, exactly-once, reconnect flush |
| M14 | Notifications | Push registration, channels, reminder/alert/message deep-link routing, PHI-free payloads |
| M15 | Backend / DB / RLS | RLS isolation, event immutability, RPCs, uniqueness/idempotency, auth trigger |
| M16 | Accessibility & i18n/RTL | Font sizes, touch targets, labels/hints, high-contrast, scaling, en/he, RTL, localized notifications |

---

## 7. Testing Strategy

Manual, risk-based testing with priority on the **patient safety path** (reminder → confirm/snooze → missed → caregiver alert) and **data isolation** (RLS). The strategy layers:

1. **Smoke** — build launches, login works, each role lands on its home.
2. **Functional** — every feature's happy path per screen.
3. **Negative / boundary / edge** — validation, empty/invalid input, limits, duplicates, rapid taps.
4. **Integration** — client↔Supabase, realtime, edge-function effects, deep links.
5. **End-to-end** — full multi-actor journeys (caregiver sets up meds → patient confirms → adherence updates; missed dose → alert).
6. **Security** — RLS cross-user access, PHI-in-push, session/token handling, immutability.
7. **Accessibility & i18n** — screen-reader labels, sizes, contrast, RTL, localization.

Two devices/accounts (one patient, one caregiver) are required to exercise the multi-actor flows and realtime.

---

## 8. Test Levels

- **Component-level manual validation** — individual controls/states (buttons, forms, badges, ReminderCard states).
- **Integration testing** — screen ↔ Supabase service ↔ DB; realtime; edge-function-triggered effects.
- **System testing** — full app per role.
- **End-to-end testing** — cross-role journeys across app + backend.
- **Acceptance testing** — mapped to `docs/requirements.md` P-/C-/M-/L-/A-/NF- IDs.

---

## 9. Functional Testing

Exercise every implemented feature's normal path (see STR §Functional). Focus areas: confirm/snooze recording, CRUD create/edit/deactivate, invite accept/revoke, alert read, messaging send/receipt, adherence calculation, settings persistence.

## 10. UI Testing

Verify layout, headers, empty states, loading spinners, error banners, badges, and role-specific styling. Verify patient screens use large typography and full-width primary actions; caregiver screens use compact layout. Verify icon+text (never color alone) for all state indicators (history status, receipts, adherence tone, alerts).

## 11. Validation Testing

Client-side field validation:
- Login/register: required fields, password ≥ `MIN_PASSWORD_LENGTH` (8), email normalization (trim + lowercase).
- Medication form: name required, amount required, unit required, patient present.
- Schedule form: medication selected, valid `HH:MM` times, valid `YYYY-MM-DD` start (and end if present), day selection required for weekly/custom.
- Reset-password: length + confirm match.
- Message composer: non-empty, max length 2000.

## 12. Negative Testing

Invalid credentials, duplicate email registration, invalid/expired recovery link, inviting non-existent email, inviting already-active patient, unauthorized cross-user actions (RLS denial), malformed time/date, over-length inputs, sending empty message.

## 13. Boundary Testing

- Snooze count: 0, 1, 2, 3 (`SNOOZE_LIMIT`) — alert fires exactly at 3.
- Grace period: dose exactly at +30 min boundary (`MISSED_GRACE_PERIOD_MINUTES`) for missed marking and pending-window inclusion.
- Password: 7 (reject) / 8 (accept) characters.
- Font scale: 1.0 min / 2.0 max (steppers disable at bounds).
- Message length: 2000 max.
- Alert badge: 99 vs 99+ display.
- Schedule times: `00:00`, `23:59` valid; `24:00`, `08:60` invalid.
- History window: 30 days default.

## 14. Edge Case Testing

Rapid double-tap confirm/snooze (idempotency), confirming a dose already taken on another device, snoozing an already-taken dose (null result path), invitation revived from revoked state, offline confirm then reconnect, app killed with queued outbox entry, session restore on cold start, DST transition dose scheduling, notification received in foreground/background/terminated states, empty medication list when creating schedule, patient with zero caregivers missing a dose.

## 15. Error Handling Testing

Verify each `AppError` code surfaces a localized message via `ErrorBanner`, never a silent empty list: `network`, `auth`, `permission`, `notFound`, `conflict`, `invalidCredentials`, `emailInUse`, `weakPassword`, `samePassword`, `rateLimit`, `expiredLink`, `unknown`. Verify retry buttons refetch. Verify optimistic actions roll back on failure and show the reason.

## 16. API Testing (Manual)

Using Postman/curl/Supabase Studio with an authenticated JWT and the `anon` key:
- RLS-protected table reads/writes return only permitted rows.
- RPC contracts (`email_exists`, `find_patient_id_by_email`, `get_patient_invitations`, `snooze_event`, `adherence_stats`).
- Edge Function endpoints (`medication-scheduler` GET/POST, `caregiver-alert` webhook payload, `send-push`, `message-push`) — status codes, idempotency, PHI-free payloads. See [`docs/api-reference.md`](docs/api-reference.md).

## 17. Database Testing (Manual)

Using Supabase Studio / psql (service role for inspection):
- `handle_new_user` trigger creates the profile row on signup (with metadata and with missing/invalid metadata defaults).
- `medication_events` DELETE is rejected for every role; UPDATE to identity columns rejected; status/taken_time/snooze_count/notes allowed.
- Uniqueness: `medication_events(schedule_id, scheduled_time)`, `messages(sender_id, client_id)`, `alerts(caregiver_id, event_id, alert_type)`, `patient_caregiver_relationships(patient_id, caregiver_id)`, `users.email`.
- Soft-delete: deactivated medications/schedules keep historical events resolvable.
- CHECK constraints: `end_date >= start_date`, `snooze_count >= 0`, `times_of_day` length ≥ 1, `patient_id <> caregiver_id`, `language IN ('he','en')`.

## 18. Integration Testing

Client↔backend for each domain service; realtime subscription updates (thread, alerts, pending event); deep-link entry from push; edge-function effects observed as new events/alerts/pushes; offline→online outbox flush.

## 19. End-to-End Testing

Full journeys spanning both roles + backend (see STR §E2E), e.g. caregiver creates medication + schedule → scheduler generates event → patient receives reminder → confirms → adherence reflects it; and missed-dose path → caregiver alert + push.

## 20. Authentication Testing

Registration (both roles), login/logout, session persistence across restart, invalid/missing credentials, duplicate email, password reset request + deep-link consumption + new password, expired reset link, remembered email/password pre-fill, role-based redirect after login.

## 21. Authorization Testing

Role isolation (patient cannot reach caregiver routes and vice versa), RLS denial for cross-patient data, only caregivers can create/edit medications/schedules, only patients can update their own events, only caregivers read/mark their own alerts, only thread members read/send messages.

## 22. Security Testing (Manual, non-destructive)

- PHI never in push payload (inspect `send-push` request body / notification content).
- `service_role` key absent from app bundle/env (`.env.local` holds only URL + anon key).
- Cross-user access attempts via direct API return zero rows / permission errors.
- Session/token handling: expired session redirects to login; recovery token single-use; email enumeration is a documented, intentional product decision (verify behavior matches doc, flag risk).
- Error messages don't leak internals (raw GoTrue strings mapped to friendly copy).

## 23. Data Integrity Testing

Audit-log immutability; idempotent scheduler (no duplicate events); exactly-once messaging and confirms; snooze increment atomicity (no lost increment under rapid taps); optimistic rollback restores true state; adherence percentages computed only from resolved doses (null → "no data", never misleading 0%).

## 24. Performance Testing Considerations (Manual Only)

Spot-check: cold start time; history list scroll with many events; realtime reconnect after toggling airplane mode; reminder poll cadence (~60s). No load scripts. NF-15/NF-16 scalability not manually verifiable — documented as a gap.

## 25. Compatibility Testing

| Dimension | Coverage |
|---|---|
| OS | Android 10+ and iOS 14+ (per constraints) |
| Runtime | Expo Go (limited: no remote push) vs. standalone/EAS dev build (full push + channels) |
| Devices | At least one small and one large screen; mid-range Android for perf |
| Orientation | Portrait (patient app expectation) |
| Font scale | OS Dynamic Type / Font Scale + in-app text-size stepper |
| Locale/RTL | English (LTR) and Hebrew (RTL) |
| Theme | Default + high-contrast |

> Note: remote push notifications are **not supported in Expo Go (SDK 53+)**; notification-tap and channel tests require a standalone/EAS build. Documented as an environment dependency.

## 26. Smoke Testing

Build installs and launches; login succeeds; patient lands on reminder/all-clear; caregiver lands on dashboard; no crash on cold start.

## 27. Sanity Testing

After a change, quickly re-verify the affected feature plus confirm/snooze and login still work.

## 28. Regression Testing

Full pass of the STR before release; targeted re-run around auth, reminder/confirm/snooze, alerts, RLS, and offline outbox after any related change.

## 29. Exploratory Testing

Time-boxed charters: "elderly-user reminder confusion," "offline/airplane-mode chaos," "rapid tapping," "two caregivers on one patient," "language switch mid-flow," "deep link while logged out."

## 30. Recovery and Resilience Testing

Network loss during confirm/send (queue + retry); app kill/restart with pending queue; realtime reconnect; recovery from failed push (event stays un-notified → retried next cron); stale/expired reminder deep link.

## 31. Test Environment

- **Devices:** 2 physical devices or emulators (1 patient account, 1 caregiver account) + optional 2nd caregiver for multi-caregiver tests.
- **Build:** EAS dev/standalone build for full notification coverage; Expo Go acceptable for non-push UI tests.
- **Backend:** Local Supabase (Docker) for DB/RLS/edge-function inspection, or a dedicated staging Supabase project. Never production data.
- **Tools:** Supabase Studio, psql/DB client, Postman/curl, device screen readers (TalkBack/VoiceOver), OS font-scale settings, airplane mode.
- **Config:** `apps/mobile/.env.local` with `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`; `supabase/config.toml` `minimum_password_length = 8`.

## 32. Test Data

- Accounts: `patient1`, `caregiver1`, `caregiver2`, plus an unregistered email for negative tests.
- Medications with/without instructions; dosage units from `dosageUnits.ts`.
- Schedules of each frequency (daily, twice_daily, three_times_daily, weekly, custom) with past/future/bounded dates.
- Seeded `medication_events` in each status to test history/adherence/missed.
- A patient in a non-UTC timezone (`users.timezone`, default `Asia/Jerusalem`) for DST/timezone tests.
- Users with `language = 'he'` and `'en'` for localized push copy.

## 33. Dependencies

Supabase (Auth, Postgres, Realtime, Edge Functions, pg_cron, DB webhooks), Expo push service (FCM/APNs), device network connectivity, AsyncStorage/SecureStore, correct `caresync://` deep-link scheme registration.

## 34. Risks

| Risk | Impact | Mitigation in test |
|---|---|---|
| Missed reminder / late push | Patient safety | E2E reminder + missed-alert timing tests; boundary at grace period |
| RLS gap | PHI leak across patients | Dedicated cross-user authorization suite |
| PHI in push payload | Privacy/HIPAA | Inspect every push body |
| Lost/duplicate confirm or message | Wrong adherence, missed alert | Offline outbox + idempotency + rapid-tap tests |
| Timezone/DST error | Dose at wrong time | Timezone + DST scheduling cases |
| Notification env limits (Expo Go) | False test failures | Run push tests only on standalone build |
| Email enumeration (intentional) | Security trade-off | Verify vs. documented decision; flag |

## 35. Assumptions

- Requirements in `docs/requirements.md` are authoritative; where code diverges, the code's actual behavior is documented and the divergence flagged.
- Testers have two accounts and a build capable of push for the full suite.
- Local/staging Supabase mirrors production migrations.
- The scheduler cron can be triggered manually (HTTP GET/POST) for deterministic testing.

## 36. Entry Criteria

- App builds and installs; backend migrations applied; test accounts provisioned; environment variables set; STR reviewed.

## 37. Exit Criteria

- 100% of Priority-1 (patient safety, auth, RLS, PHI) cases executed with no open Critical/High defect.
- ≥95% of all planned cases executed; all Critical/High defects resolved or explicitly accepted.
- Accessibility Must-Have requirements (P-12…P-16) pass on patient screens.
- No known data-integrity or authorization defect open.

## 38. Defect Management

Log each defect with: ID, title, module, severity (Critical/High/Medium/Low), priority, environment/build, preconditions, steps, expected vs. actual, evidence (screenshot/log/network capture), related requirement/Test Case ID. Severity guide: Critical = patient-safety or data-isolation failure; High = core flow broken; Medium = functional issue with workaround; Low = cosmetic/copy.

## 39. Test Prioritization

1. **P1 (must pass):** Auth, reminder confirm/snooze, missed→alert, snooze-limit→alert, RLS isolation, PHI-free push, event immutability, offline confirm exactly-once.
2. **P2:** Medication/schedule CRUD, invitations, alerts inbox, adherence, messaging, settings persistence, deep links.
3. **P3:** Empty/loading/error states, copy, badges, exploratory, minor accessibility polish.

## 40. Quality Gates

- Smoke pass required before deeper testing.
- P1 suite green before release candidate.
- Security (RLS + PHI) and accessibility Must-Haves are hard gates.

---

## Appendix A — Requirement Traceability (summary)

| Requirement group | Source IDs | Covered by STR types |
|---|---|---|
| Patient reminder | P-01…P-09 | Functional, Boundary, Edge, Integration, E2E, Accessibility |
| Patient history | P-10…P-11 | Functional, UI |
| Accessibility | P-12…P-18, NF-12…NF-14 | Accessibility |
| Caregiver meds/schedules | C-01…C-06 | Functional, Validation, Negative |
| Patient management | C-07…C-10 | Functional, Negative, Auth |
| Monitoring/alerts | C-11…C-18 | Functional, Integration, Boundary, E2E |
| Multi-caregiver | M-01…M-03 | Integration, Auth, E2E |
| Event logging | L-01…L-04 | DB, Data Integrity |
| Authentication | A-01…A-05 | Auth, Negative |
| Reliability/Security | NF-01…NF-11 | Integration, Security, Recovery |

## Appendix B — Reference Documentation

- [`docs/requirements.md`](docs/requirements.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/db-schema.md`](docs/db-schema.md)
- [`docs/ui-guidelines.md`](docs/ui-guidelines.md)
- [`docs/notification-flow.md`](docs/notification-flow.md)
- [`docs/api-reference.md`](docs/api-reference.md)
- [`docs/deployment.md`](docs/deployment.md)
