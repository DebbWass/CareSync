# CareSync — Manual Test Specification (STR)

**Document type:** Software Test Requirements / Manual Test Specification
**Project:** CareSync
**Companion:** [`STP.md`](STP.md) (strategy). This document contains the executable manual test cases.
**Version:** 1.0
**Date:** 2026-07-23
**Language:** English (all cases are human-executable — no automation).

---

## How to Use This Document

Each test case can be executed by a human tester and produces a **PASS/FAIL** verdict from an observable expected result.

**Test Case ID convention:** `TC-<MODULE>-<TYPE>-<NNN>`
Types: `FUNC` (functional), `NEG` (negative), `BOUND` (boundary), `EDGE` (edge case), `INT` (integration), `E2E` (end-to-end), `AUTH` (authz/authn), `SEC` (security), `DB` (database), `A11Y` (accessibility), `I18N` (localization/RTL), `ERR` (error handling), `UI` (ui/state).

**Priority:** P1 (patient-safety/security/auth), P2 (core feature), P3 (polish).
**Severity if failed:** Critical / High / Medium / Low.

**Global preconditions (unless a case states otherwise):**
- App installed and launched on a supported device/emulator.
- A **standalone/EAS build** is used for any notification/deep-link case (Expo Go SDK 53+ cannot receive remote push).
- Test accounts exist: `patient1` (role patient), `caregiver1` (role caregiver), `caregiver2` (role caregiver), and one **unregistered** email.
- Backend is local/staging Supabase with migrations applied — never production data.

**Key constants (from `src/constants/config.ts`):** `SNOOZE_LIMIT = 3`, `MISSED_GRACE_PERIOD_MINUTES = 30`, `SNOOZE_OPTIONS_MINUTES = [15,30,60]`, `MIN_PASSWORD_LENGTH = 8`, `HISTORY_DEFAULT_DAYS = 30`, `ADHERENCE_WINDOW_DAYS = 30`, `MAX_MESSAGE_LENGTH = 2000`.

---

## Coverage Matrix

| Module | Feature | Functional | Negative | Boundary | Edge | Integration | E2E | Auth | Data/DB | A11y/I18N | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M1 Authentication | Login/Register/Logout/Reset | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M2 Patient Reminder | Confirm/Snooze/Deep-link | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M3 Patient History | List/status | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M4 Patient Invitations | Accept/Decline | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M5 Settings | Language/Contrast/Text size | ✓ | – | ✓ | ✓ | ✓ | – | – | ✓ | ✓ | Covered |
| M6 Caregiver Dashboard | Cards/Badges/Actions | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M7 Medications | List/Add/Edit/Deactivate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M8 Schedules | List/Add/Edit/Deactivate | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M9 Patients | Invite/Cancel/Revoke | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M10 Alerts | List/Mark read | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M11 Adherence | Headline/Trend | ✓ | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M12 Messaging | Thread/Send/Receipts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Covered |
| M13 Offline/Sync | Outbox/Backoff | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | Covered |
| M14 Notifications | Push/Deep-link/PHI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ | Partially (Expo Go limits) |
| M15 Backend/DB/RLS | RLS/Immutability/RPC | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | Covered |
| M16 Accessibility/i18n | Sizes/Labels/RTL | ✓ | – | ✓ | ✓ | – | – | – | – | ✓ | Covered |

Legend: ✓ = cases present, – = not applicable / not the focus for that module.

---

# M1 — Authentication

**Screens:** `app/(auth)/login.tsx`, `register.tsx`, `forgot-password.tsx`, `app/reset-password.tsx`. **Service:** `src/services/supabase/auth.ts`. **Errors:** `errors.ts` (GoTrue code mapping).

### Functional

#### TC-AUTH-FUNC-001 — Register a new caregiver (happy path)
- **Priority:** P1 · **Severity if failed:** Critical
- **Preconditions:** Logged out; email not yet registered.
- **Steps:**
  1. Open the app; on the login screen tap "Register".
  2. Enter a full name, a new valid email, and a password ≥ 8 characters.
  3. Confirm the role selector defaults to "Caregiver" (leave as Caregiver).
  4. Tap "Create account".
- **Expected:** No validation error; a session is created; the app auto-redirects to the caregiver dashboard (root AuthGuard). A `public.users` row is created with role `caregiver` (verify in DB, TC-DB-INT-001).

#### TC-AUTH-FUNC-002 — Register a new patient
- **Priority:** P1 · **Severity:** Critical
- **Steps:** As above but select role "Patient" before submitting.
- **Expected:** After signup the app redirects to the **patient** home (reminder/all-clear). DB row role = `patient`.

#### TC-AUTH-FUNC-003 — Login with valid credentials
- **Priority:** P1 · **Severity:** Critical
- **Steps:** On login, enter a registered email + correct password, tap "Login".
- **Expected:** Authenticated and routed to the role's home. Email is trimmed and lower-cased before submit (verify a mixed-case email still logs in).

#### TC-AUTH-FUNC-004 — Logout
- **Priority:** P1 · **Severity:** High
- **Steps:** From caregiver dashboard tap "Sign out" (or patient path equivalent).
- **Expected:** Session cleared; app redirects to login. Relaunching stays on login.

#### TC-AUTH-FUNC-005 — Session persists across app restart
- **Priority:** P1 · **Severity:** High · **Requirement:** A-04, NF-... session restore
- **Steps:** Log in, fully close the app, relaunch.
- **Expected:** No login prompt; the user lands directly on their role home. During restore the user is **not** briefly bounced to login (AuthGuard waits for `isAuthReady`).

#### TC-AUTH-FUNC-006 — "Remember me" pre-fills email and password
- **Priority:** P2 · **Severity:** Medium
- **Steps:** On login, ensure "Remember me" is checked, log in successfully, log out, return to login.
- **Expected:** Email is pre-filled from `settingsStore.rememberedEmail`; password is pre-filled from SecureStore (remembered password). Typing in either field takes over from the remembered value without being clobbered when the async value resolves.

#### TC-AUTH-FUNC-007 — "Remember me" unchecked clears saved credentials
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Log in with "Remember me" **unchecked**; log out; return to login.
- **Expected:** Email and password fields are empty (remembered email set to null, remembered password cleared).

#### TC-AUTH-FUNC-008 — Password reset request (existing email)
- **Priority:** P2 · **Severity:** High · **Requirement:** A-05
- **Steps:** From login tap "Forgot password"; enter a registered email; tap send.
- **Expected:** A confirmation screen ("email sent") shows the entered address; a recovery email is dispatched. `emailExists` returns true so no "no account" message appears.

#### TC-AUTH-FUNC-009 — Reset password via deep link (happy path)
- **Priority:** P1 · **Severity:** High
- **Preconditions:** Received a recovery email for a registered account.
- **Steps:**
  1. Open the recovery link (`caresync://reset-password#access_token=…&refresh_token=…&type=recovery`).
  2. On the reset screen wait for "restoring" to resolve to the form.
  3. Enter a new password ≥ 8 chars in both fields (matching); tap save.
  4. On success, tap continue.
- **Expected:** Screen shows success, then routes to `/` and the user is signed in with the new password. The AuthGuard does not redirect away from `reset-password` mid-flow.

### Negative

#### TC-AUTH-NEG-001 — Login with wrong password
- **Priority:** P1 · **Severity:** High
- **Steps:** Enter a registered email + incorrect password; tap Login.
- **Expected:** Inline error uses the `invalidCredentials` message (mapped from GoTrue `invalid_credentials`), **not** the generic "session expired" text. No navigation occurs.

#### TC-AUTH-NEG-002 — Login with empty fields
- **Steps:** Leave email and/or password empty; tap Login.
- **Expected:** "Fill all fields" validation message; no network call.

#### TC-AUTH-NEG-003 — Register with duplicate email
- **Priority:** P1 · **Severity:** High
- **Steps:** Register using an email that already has an account.
- **Expected:** Error mapped to `emailInUse` ("email already in use"). No second account is created. (Covers both GoTrue confirmations-off rejection and the empty-`identities` anti-enumeration path.)

#### TC-AUTH-NEG-004 — Register with short password
- **Priority:** P2 · **Severity:** Medium · **Boundary:** see BOUND-001
- **Steps:** Enter name + email + a 7-character password; submit.
- **Expected:** "Password too short (min 8)" message; no signup call.

#### TC-AUTH-NEG-005 — Forgot-password for a non-existent email
- **Priority:** P2 · **Severity:** Medium
- **Steps:** On forgot-password enter an email with no account; tap send.
- **Expected:** Explicit "no account" message is shown (product decision via `emailExists`); no recovery email sent.

#### TC-AUTH-NEG-006 — Reset via expired/stale link
- **Priority:** P2 · **Severity:** High
- **Steps:** Open a recovery link whose fragment carries `error_code=otp_expired` (or an old link).
- **Expected:** Reset screen shows the "invalid/expired link" state (mapped to `expiredLink`) with a "request new" button that routes to forgot-password.

#### TC-AUTH-NEG-007 — Reset with mismatched passwords
- **Steps:** On the reset form enter two different passwords; save.
- **Expected:** "Passwords do not match" message; no update call.

#### TC-AUTH-NEG-008 — Reset with same password as before
- **Priority:** P3 · **Severity:** Low
- **Steps:** On the reset form set the new password equal to the current one.
- **Expected:** Error mapped to `samePassword` (GoTrue `same_password`).

### Boundary

#### TC-AUTH-BOUND-001 — Password length boundary (7 vs 8)
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Register/reset with exactly 7 chars (expect reject) then exactly 8 chars (expect accept, assuming server complexity allows).
- **Expected:** 7 → "too short"; 8 → passes client validation and proceeds to the backend call.

#### TC-AUTH-BOUND-002 — Rate limit on repeated reset requests
- **Priority:** P3 · **Severity:** Low
- **Steps:** Trigger many password-reset emails rapidly for the same address.
- **Expected:** Eventually the `rateLimit` message appears (GoTrue `over_email_send_rate_limit`).

### Edge

#### TC-AUTH-EDGE-001 — Recovery link consumed by auth listener before screen mounts
- **Priority:** P3 · **Severity:** Medium
- **Steps:** Open a valid recovery link where the session is installed before the reset screen finishes mounting (no tokens left in URL for the screen).
- **Expected:** Screen still shows the form because an existing session is detected (`restored || hasSession`), not the invalid state.

#### TC-AUTH-EDGE-002 — First login right after signup (profile trigger lag)
- **Priority:** P2 · **Severity:** High
- **Steps:** Register and immediately observe routing.
- **Expected:** The app does not bounce the fresh user back to login while the `handle_new_user` trigger commits (getProfile retries up to 3× / ~700ms). User reaches their role home.

### Authorization / Security

#### TC-AUTH-SEC-001 — service_role key absent from client
- **Priority:** P1 · **Severity:** Critical · **Requirement:** NF-10
- **Steps:** Inspect `apps/mobile/.env.local` and the built bundle for any `service_role`/secret key.
- **Expected:** Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are present. No service_role key anywhere in the client.

#### TC-AUTH-SEC-002 — Expired/invalid session redirects to login
- **Priority:** P1 · **Severity:** High
- **Steps:** Invalidate the session (e.g., revoke on server / clear token) and interact with a protected screen.
- **Expected:** A `401`/auth error maps to the `auth` code; the AuthGuard redirects to login. No protected data is shown.

---

# M2 — Patient: Medication Reminder

**Screens:** `app/(patient)/index.tsx`, `app/reminder/[eventId].tsx`, `components/patient/ReminderCard.tsx`. **Hooks/services:** `useMedicationEvent.ts`, `services/supabase/events.ts`.

### Functional

#### TC-REM-FUNC-001 — Pending reminder displays full dose details
- **Priority:** P1 · **Severity:** Critical · **Requirement:** P-02, P-03
- **Preconditions:** A `medication_events` row for `patient1` with status `pending`, `scheduled_time` ≤ now + grace, medication has name/dosage/instructions.
- **Steps:** Log in as `patient1`; observe the home screen (or wait for the 60s poll).
- **Expected:** Fullscreen ReminderCard shows scheduled time, "time to take" label, medication **name** (large, 48sp), dosage, and instructions. A full-width "Confirm/Taken" button (≥80dp) and three snooze options (15/30/60) are visible with "snoozes remaining".

#### TC-REM-FUNC-002 — Confirm a dose ("Taken")
- **Priority:** P1 · **Severity:** Critical · **Requirement:** P-04
- **Steps:** On the ReminderCard tap the confirm button.
- **Expected:** The reminder disappears **immediately** (optimistic); home shows all-clear. In DB the event becomes `status='taken'` with a `taken_time`. History later shows it as Taken.

#### TC-REM-FUNC-003 — Snooze a dose
- **Priority:** P1 · **Severity:** Critical · **Requirement:** P-05, P-06
- **Steps:** On the ReminderCard tap "30 min" (or any option).
- **Expected:** Card shows a spinner on the chosen option, then the reminder clears; `snooze_count` increments by 1 and status becomes `snoozed`; "snoozes remaining" decreases by 1 next time it appears.

#### TC-REM-FUNC-004 — Reminder via push deep link
- **Priority:** P1 · **Severity:** High · **Requirement:** P-01, P-08 (standalone build)
- **Steps:** With a pending event, receive the reminder push; tap it.
- **Expected:** App deep-links to `reminder/[eventId]`, fetches the event by ID, and shows the ReminderCard. Confirm/snooze here returns the user to patient home on success.

#### TC-REM-FUNC-005 — All-clear state when no dose is due
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Log in as a patient with no pending/snoozed dose within the window.
- **Expected:** Large ✓, "all clear" title/body, and a link to History.

### Negative / Error

#### TC-REM-NEG-001 — Confirm fails due to permission error → rollback
- **Priority:** P1 · **Severity:** High
- **Steps:** Force a non-network failure on confirm (e.g., simulate RLS/permission denial) and tap confirm.
- **Expected:** The optimistic "taken" state rolls back to the reminder; an ErrorBanner explains the failure (localized). The dose is **not** marked taken in DB.

#### TC-REM-NEG-002 — Reminder deep link for a non-existent/expired event
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Open `caresync://reminder/<unknown-uuid>`.
- **Expected:** "Not found" state (already cleaned up/expired) with a "go home" link; no crash.

#### TC-REM-ERR-001 — Pending fetch network error shows retry
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Enable airplane mode; open patient home.
- **Expected:** ErrorBanner with a Retry action (not an empty/all-clear screen). Retry after reconnect loads the reminder.

### Boundary

#### TC-REM-BOUND-001 — Snooze limit reached (count = SNOOZE_LIMIT)
- **Priority:** P1 · **Severity:** High · **Requirement:** C-12
- **Preconditions:** Event `snooze_count = 3`.
- **Steps:** Open the reminder.
- **Expected:** Snooze options are **hidden/disabled**; a "snooze limit reached" alert message is shown (role=alert). Only confirm remains.

#### TC-REM-BOUND-002 — Grace-window inclusion boundary
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Create a pending event with `scheduled_time` = now + exactly 30 min, and another at now + 31 min.
- **Expected:** The +30 event appears within the pending window; the +31 event does not (pending query window = now + `MISSED_GRACE_PERIOD_MINUTES`).

### Edge / Data integrity

#### TC-REM-EDGE-001 — Rapid double-tap confirm is idempotent
- **Priority:** P1 · **Severity:** High
- **Steps:** Tap the confirm button twice as fast as possible.
- **Expected:** Exactly one taken record; no duplicate/error. The `status <> 'taken'` guard prevents clobbering `taken_time`.

#### TC-REM-EDGE-002 — Snooze a dose already taken elsewhere (null path)
- **Priority:** P2 · **Severity:** Medium
- **Steps:** On device A confirm the dose; on device B (same patient) tap snooze on the still-shown card.
- **Expected:** Snooze RPC returns null (no longer snoozable); after invalidation device B shows the true state (taken/cleared). No error banner for this legitimate outcome.

#### TC-REM-EDGE-003 — Rapid double snooze increments exactly once per tap (atomic)
- **Priority:** P1 · **Severity:** High
- **Steps:** Tap two different snooze options in quick succession.
- **Expected:** `snooze_count` reflects the correct number of increments (atomic RPC `snooze_count = snooze_count + 1`); no lost increment that would delay the caregiver alert.

### Accessibility

#### TC-REM-A11Y-001 — ReminderCard screen-reader labels
- **Priority:** P1 · **Severity:** High · **Requirement:** P-14, P-16
- **Steps:** Enable TalkBack/VoiceOver; navigate the ReminderCard.
- **Expected:** Time, medication name (header), dosage, instructions, confirm button (label+hint), and each snooze button (label+hint with minutes) are announced. Confirm button announces as a button.

#### TC-REM-A11Y-002 — Confirm button size and full width
- **Priority:** P1 · **Severity:** High · **Requirement:** P-04, P-15
- **Steps:** Inspect the confirm button.
- **Expected:** Full-width, minimum 80dp height (size="large"). Snooze buttons ≥ 56dp height.

---

# M3 — Patient: History

**Screen:** `app/(patient)/history.tsx`. **Service:** `getEventHistory` (last 30 days, statuses taken/missed/snoozed).

#### TC-HIST-FUNC-001 — History lists resolved events newest-first
- **Priority:** P2 · **Severity:** Medium · **Requirement:** P-10, P-11
- **Steps:** As a patient with historical events, open History (link from all-clear).
- **Expected:** Rows show medication name, dosage, scheduled date/time, taken time (if taken), and a status badge (icon + label): ✓ taken, ✗ missed, ⏱ snoozed. Order is newest first.

#### TC-HIST-UI-001 — Empty history state
- **Priority:** P3 · **Severity:** Low
- **Steps:** New patient with no resolved events opens History.
- **Expected:** Localized empty message; no crash.

#### TC-HIST-A11Y-001 — Status conveyed by icon+text, not color alone
- **Priority:** P2 · **Severity:** Medium · **Requirement:** ui-guidelines
- **Steps:** Review each status row (also in high-contrast).
- **Expected:** Each status has an icon and a text label in addition to color. Row accessibility label reads name, status, date, and taken time.

#### TC-HIST-BOUND-001 — 30-day window
- **Priority:** P3 · **Severity:** Low
- **Steps:** Seed events at 29 days and 31 days ago.
- **Expected:** The 29-day event appears; the 31-day event does not (default `HISTORY_DEFAULT_DAYS`).

---

# M4 — Patient: Caregiver Invitations

**Component:** `components/patient/PatientInvitations.tsx`. **Service:** `getPatientInvitations`, `respondToInvitation`. Shown on patient home only when no dose is due.

#### TC-INV-FUNC-001 — Accept a caregiver invitation
- **Priority:** P1 · **Severity:** High · **Requirement:** C-08
- **Preconditions:** A pending relationship where `caregiver1` invited `patient1`; patient has no active dose.
- **Steps:** As `patient1`, on home see the invitation card (caregiver name + email); tap "Accept".
- **Expected:** Relationship status → `active`; card disappears; caregiver now sees the patient as active (TC-PAT-INT-001). Button shows loading while pending.

#### TC-INV-FUNC-002 — Decline a caregiver invitation
- **Priority:** P2 · **Severity:** Medium
- **Steps:** As `patient1` tap "Decline".
- **Expected:** Relationship status → `revoked`; card disappears; caregiver does not gain access.

#### TC-INV-EDGE-001 — Reminder takes priority over invitations
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Ensure the patient has both a pending dose and a pending invitation; open home.
- **Expected:** The ReminderCard is shown (not the invitation). Invitations appear only after the dose is resolved.

#### TC-INV-ERR-001 — Accept fails (network) shows error, no state change
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Airplane mode; tap Accept.
- **Expected:** ErrorBanner shown; relationship stays pending; buttons re-enable.

#### TC-INV-A11Y-001 — Accept/decline accessible
- **Steps:** With screen reader, focus the buttons.
- **Expected:** Accept announces label+hint including caregiver name; Decline announces label with caregiver name; Accept is the large confirm-style button.

---

# M5 — Settings (Patient & Caregiver)

**Component:** `components/settings/SettingsPanel.tsx`. **Store:** `settingsStore.ts`. **Hook:** `useLanguageSwitcher`.

#### TC-SET-FUNC-001 — Toggle high-contrast mode
- **Priority:** P2 · **Severity:** Medium · **Requirement:** P-13
- **Steps:** Open Settings; toggle "High contrast" on.
- **Expected:** Patient screens (reminder, history) immediately switch to the high-contrast theme; setting persists after app restart.

#### TC-SET-FUNC-002 — Increase/decrease text size
- **Priority:** P2 · **Severity:** Medium · **Requirement:** NF-14
- **Steps:** Tap "A+" repeatedly, then "A−".
- **Expected:** Displayed percentage updates in steps of 25%; text in the design-system `<Text/>` scales accordingly; value persists.

#### TC-SET-BOUND-001 — Text-size min/max clamp
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Tap "A−" until minimum, then "A+" until maximum.
- **Expected:** At 100% the "A−" button is disabled; at 200% the "A+" button is disabled (scale clamped to [1.0, 2.0]).

#### TC-SET-FUNC-003 — Change language (English/Hebrew/Device)
- **Priority:** P1 · **Severity:** High · **Requirement:** i18n
- **Steps:** Select "עברית", then "English", then device default.
- **Expected:** UI copy switches immediately; Hebrew flips layout to RTL (TC-I18N-001). A ✓ + bold marks the selection (never color alone). For a signed-in user, `users.language` is persisted so notification copy follows (TC-NOTIF-INT-003).

#### TC-SET-A11Y-001 — Settings controls accessible & large
- **Steps:** With screen reader, traverse language radios and steppers.
- **Expected:** Language options announce as radios with checked state; steppers announce increase/decrease with disabled state at bounds; rows meet ≥48dp touch target.

---

# M6 — Caregiver: Dashboard

**Screen:** `app/(caregiver)/index.tsx`. Hooks: `useLinkedPatients`, `useUnreadAlertCount`, `useAdherence`.

#### TC-DASH-FUNC-001 — Dashboard lists linked patients with adherence badge
- **Priority:** P1 · **Severity:** High · **Requirement:** C-15
- **Steps:** Log in as `caregiver1` with ≥1 active patient; view dashboard.
- **Expected:** Greeting with first name; each active patient card shows initial avatar, name, an adherence badge (icon + %, or "no data"), and a message button. Tapping the card opens that patient's medications.

#### TC-DASH-FUNC-002 — Alert badge shows unread count
- **Priority:** P2 · **Severity:** Medium · **Requirement:** C-18
- **Steps:** With N unread alerts, view the dashboard header bell.
- **Expected:** Badge shows N (or "99+" if >99). Tapping opens the alerts inbox.

#### TC-DASH-FUNC-003 — Quick actions routing
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Tap Medications, Schedules, Patients, Alerts action cards.
- **Expected:** Medications: if exactly 1 patient, opens that patient's meds directly; otherwise opens the patient picker. Others route to their screens. Alerts card highlights (danger style) when unread > 0.

#### TC-DASH-UI-001 — Empty state (no patients)
- **Priority:** P3 · **Severity:** Low
- **Steps:** New caregiver with no patients.
- **Expected:** Dashed empty card "no patients" with an "add patient" action routing to Patients.

#### TC-DASH-BOUND-001 — Alert badge 99 vs 99+
- **Steps:** Seed 99 then 100 unread alerts.
- **Expected:** 99 shows "99"; 100 shows "99+".

---

# M7 — Caregiver: Medication Management

**Screens:** `medications/index.tsx`, `medications/new.tsx`, `medications/[id].tsx`. **Service:** `medications.ts`.

### Functional

#### TC-MED-FUNC-001 — Add a medication (happy path)
- **Priority:** P1 · **Severity:** High · **Requirement:** C-01
- **Preconditions:** Caregiver linked (active) to `patient1`.
- **Steps:** From a patient's medications list tap add; enter name (e.g., "Aspirin"), amount ("100"), pick unit ("mg"), optional instructions; tap save.
- **Expected:** Medication created with `dosage = "100 mg"` (amount + localized unit); list refreshes with the new item; screen returns back.

#### TC-MED-FUNC-002 — Edit a medication
- **Priority:** P2 · **Severity:** Medium · **Requirement:** C-02
- **Steps:** Open a medication's edit screen; change dosage/instructions; save.
- **Expected:** Changes persist and show in the list.

#### TC-MED-FUNC-003 — Deactivate (soft-delete) a medication
- **Priority:** P2 · **Severity:** High · **Requirement:** C-03, L-03
- **Steps:** Deactivate a medication.
- **Expected:** It disappears from the active list (`is_active=false`); historical `medication_events` referencing it remain and still resolve its name in history/adherence (TC-DB-INT-004).

### Negative / Validation

#### TC-MED-NEG-001 — Missing required fields
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Attempt to save with (a) empty name, (b) empty amount, (c) no unit selected — one at a time.
- **Expected:** Specific validation message for each ("name required" / "amount required" / "unit required"); no create call.

#### TC-MED-NEG-002 — Create without a patient context
- **Priority:** P3 · **Severity:** Low
- **Steps:** Reach the add form without a `patientId` param.
- **Expected:** "No patient" validation error; no create.

#### TC-MED-EDGE-001 — Long/Unicode/whitespace name
- **Priority:** P3 · **Severity:** Low
- **Steps:** Save a very long name, a Unicode name (e.g., Hebrew), and a name that is only spaces.
- **Expected:** Spaces-only is rejected (trimmed empty → name required). Long/Unicode names save and render without layout break (truncation where designed).

### Authorization

#### TC-MED-AUTH-001 — Only active caregivers can create/edit meds (RLS)
- **Priority:** P1 · **Severity:** Critical · **Requirement:** NF-09
- **Steps:** Using an API client authenticated as a caregiver **not** linked to `patient1`, attempt to insert/update a medication for `patient1`.
- **Expected:** Insert/update denied by RLS (permission error, code 42501 → `permission`). No row created/changed.

---

# M8 — Caregiver: Schedule Management

**Screens:** `schedules/index.tsx`, `schedules/new.tsx`, `schedules/[id].tsx`. **Service:** `schedules.ts`. **Utils:** `scheduleUtils` (isValidTime/isValidDate).

### Functional

#### TC-SCH-FUNC-001 — Create a daily schedule
- **Priority:** P1 · **Severity:** High · **Requirement:** C-04, C-06
- **Steps:** From a patient context open add-schedule; select a medication chip; frequency "daily"; keep default time; set start date = today; leave end blank; save.
- **Expected:** Schedule created (is_active=true), `times_of_day` = the entered HH:MM, `days_of_week` = null for daily; list refreshes.

#### TC-SCH-FUNC-002 — Create a weekly/custom schedule with selected days
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Select frequency "weekly" (or "custom"); the day picker appears; select ≥1 day; ensure ≥1 valid time; save.
- **Expected:** Schedule stores the selected `days_of_week` (0=Sun..6=Sat). Multiple time slots can be added/removed for custom/weekly.

#### TC-SCH-FUNC-003 — Twice/three-times daily default time slots
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Switch frequency to twice_daily then three_times_daily.
- **Expected:** The number of time inputs adjusts to the frequency's default slot count; slots cannot be removed below the minimum for that frequency.

#### TC-SCH-FUNC-004 — Edit / deactivate a schedule
- **Priority:** P2 · **Severity:** Medium · **Requirement:** C-05
- **Steps:** Edit times/date range; save. Then deactivate the schedule.
- **Expected:** Edits persist; deactivated schedule leaves the active list; the scheduler stops generating new events for it.

### Negative / Boundary / Validation

#### TC-SCH-NEG-001 — Save with no medication selected
- **Steps:** Attempt save without picking a medication.
- **Expected:** "Select medication" error; no create.

#### TC-SCH-NEG-002 — Invalid time format
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Enter a time like "8", "08:60", "24:00", "ab:cd"; save.
- **Expected:** "Time format" error; no create. (`isValidTime` regex `([01]\d|2[0-3]):([0-5]\d)`.)

#### TC-SCH-BOUND-001 — Time boundaries
- **Steps:** Enter "00:00" and "23:59" (valid), then "23:60" and "24:00" (invalid).
- **Expected:** 00:00 and 23:59 accepted; 23:60 / 24:00 rejected.

#### TC-SCH-NEG-003 — Invalid or reversed dates
- **Priority:** P2 · **Severity:** Medium
- **Steps:** (a) Enter a malformed start date; (b) enter end date before start date.
- **Expected:** (a) "Start date" error client-side. (b) Client passes but DB CHECK (`end_date >= start_date`) rejects → surfaced as an error (no schedule created).

#### TC-SCH-NEG-004 — Weekly/custom with no day selected
- **Steps:** Choose weekly/custom, select no days; save.
- **Expected:** "Select a day" error; no create.

#### TC-SCH-EDGE-001 — Create schedule when patient has no medications
- **Priority:** P3 · **Severity:** Low
- **Steps:** Open add-schedule for a patient with zero medications.
- **Expected:** "No medications" hint shown; cannot select a medication; save blocked by validation.

### Integration (scheduling correctness)

#### TC-SCH-INT-001 — Scheduler generates events for an active schedule
- **Priority:** P1 · **Severity:** High · **Requirement:** L-01
- **Steps:** Create a schedule with an imminent time; trigger `medication-scheduler` (HTTP GET/POST) or wait for cron.
- **Expected:** `medication_events` rows are created for upcoming doses (status pending) within the 24h lookahead; response `new_events` > 0. Re-running does not duplicate (unique `schedule_id, scheduled_time`).

#### TC-SCH-INT-002 — Timezone correctness
- **Priority:** P1 · **Severity:** High
- **Steps:** Set the patient's `users.timezone` to a non-UTC zone; create an "08:00" daily schedule; run the scheduler.
- **Expected:** The generated `scheduled_time` (UTC) corresponds to 08:00 in the patient's local timezone.

#### TC-SCH-EDGE-002 — DST transition dose still fires
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Configure a schedule crossing a DST spring-forward/fall-back date; run the scheduler.
- **Expected:** Spring-forward nonexistent local time maps forward (dose still created); fall-back overlap creates a single dose (first occurrence). Wall-clock time stays consistent for the patient.

---

# M9 — Caregiver: Patient Management (Invitations)

**Screen:** `patients/index.tsx`. **Service:** `patients.ts` (`invitePatientByEmail`, `cancelInvitation`, `revokeAccess`).

#### TC-PAT-FUNC-001 — Invite a patient by email
- **Priority:** P1 · **Severity:** High · **Requirement:** C-07
- **Preconditions:** A registered patient account exists (`patient1`).
- **Steps:** As `caregiver1`, open Patients; enter `patient1`'s email; tap invite.
- **Expected:** Success message; the invite appears under "Pending". A relationship row (status pending) is created via `find_patient_id_by_email` RPC + insert. Patient will see it (TC-INV-FUNC-001).

#### TC-PAT-NEG-001 — Invite a non-existent email
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Enter an email that has no patient account; invite.
- **Expected:** Contextual "no patient found" message (`notFound`); no relationship created.

#### TC-PAT-NEG-002 — Invite an already-active patient
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Invite a patient already actively linked to this caregiver.
- **Expected:** "Already linked" conflict message; no duplicate/state change (revive logic only revives non-active rows).

#### TC-PAT-EDGE-001 — Re-invite a previously revoked patient (revive)
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Revoke access to a patient, then invite the same email again.
- **Expected:** The existing revoked/cancelled relationship is revived to `pending` (not a duplicate row); appears under Pending.

#### TC-PAT-NEG-003 — Empty email
- **Steps:** Tap invite with an empty field.
- **Expected:** "Enter email" validation; no call.

#### TC-PAT-FUNC-002 — Cancel a pending invitation
- **Priority:** P2 · **Severity:** Medium
- **Steps:** In Pending, tap ✕ on an invite; confirm the dialog.
- **Expected:** Relationship → `revoked`; removed from Pending.

#### TC-PAT-FUNC-003 — Revoke access to an active patient
- **Priority:** P2 · **Severity:** High · **Requirement:** C-10
- **Steps:** On an active patient row tap ✕; confirm.
- **Expected:** Relationship → `revoked`; patient removed from the active list; caregiver loses access (RLS now denies that patient's data).

#### TC-PAT-INT-001 — Multi-caregiver: two caregivers on one patient
- **Priority:** P1 · **Severity:** High · **Requirement:** M-01, M-02, M-03
- **Steps:** Link both `caregiver1` and `caregiver2` (active) to `patient1`. Trigger a missed/over-snooze event.
- **Expected:** Both caregivers can manage meds/schedules and both receive an alert + push for the same event.

#### TC-PAT-AUTH-001 — Caregiver cannot read a non-linked patient's data
- **Priority:** P1 · **Severity:** Critical · **Requirement:** NF-09
- **Steps:** As `caregiver2` (not linked to `patient1`), attempt via API to read `patient1`'s medications/events/messages.
- **Expected:** Zero rows returned (RLS). No PHI exposure.

---

# M10 — Caregiver: Alerts Inbox

**Screen:** `alerts.tsx`. **Service:** `alerts.ts`.

#### TC-ALT-FUNC-001 — Alerts list renders with type + patient + time
- **Priority:** P2 · **Severity:** High · **Requirement:** C-13
- **Steps:** As a caregiver with alerts, open the inbox.
- **Expected:** Newest-first list; each row shows a type icon+label (⚠ missed / ⏱ snooze-limit / 📉 low adherence / 💊 new medication), patient name, scheduled time (if present), and created time. Unread rows are visually distinct and show an unread dot + mark-read control.

#### TC-ALT-FUNC-002 — Mark a single alert read
- **Priority:** P2 · **Severity:** Medium · **Requirement:** C-14
- **Steps:** Tap ✓ on an unread alert.
- **Expected:** Row becomes read (dot/mark-read control removed); unread count and dashboard badge decrease by 1.

#### TC-ALT-FUNC-003 — Mark all read
- **Priority:** P2 · **Severity:** Medium
- **Steps:** With multiple unread, tap "Read all".
- **Expected:** All alerts become read; header subtitle count clears; dashboard badge → 0.

#### TC-ALT-UI-001 — Empty state
- **Steps:** Caregiver with no alerts opens inbox.
- **Expected:** ✓ icon with "all clear" empty title/body.

#### TC-ALT-INT-001 — Realtime alert appears without manual refresh
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Keep the inbox open; cause a new alert (missed dose) on the backend.
- **Expected:** The new alert appears (realtime/refetch) and the unread count updates.

#### TC-ALT-A11Y-001 — Alert row accessible summary
- **Steps:** Screen reader on a row.
- **Expected:** Announces unread prefix (if unread), type, patient, scheduled time, and created date as one coherent label; icon+text (never color alone).

---

# M11 — Caregiver: Adherence Analytics

**Screen:** `patients/[patientId].tsx`. **Service:** `analytics.ts` (`adherence_stats` RPC, `summarizeAdherence`).

#### TC-ADH-FUNC-001 — Headline adherence percentage
- **Priority:** P2 · **Severity:** Medium · **Requirement:** C-16
- **Preconditions:** Patient has resolved doses (taken + missed) in the last 30 days.
- **Steps:** Open the patient's adherence screen (tap the badge).
- **Expected:** Headline shows the correct rounded % = taken/(taken+missed)×100 over the window, plus "taken of total" and a tone icon (good/fair/low).

#### TC-ADH-FUNC-002 — Per-day trend bars
- **Priority:** P3 · **Severity:** Low
- **Steps:** Scroll the horizontal trend.
- **Expected:** One bar per patient-local day; bar height and color match that day's %; each column has an accessible per-day label (date, %, taken/total).

#### TC-ADH-EDGE-001 — No-data state (no resolved doses)
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Open adherence for a patient with only pending/no doses.
- **Expected:** "No data" state (percent is null, never a misleading 0%). The dashboard badge likewise shows "no data".

#### TC-ADH-AUTH-001 — Adherence RPC respects RLS
- **Priority:** P1 · **Severity:** High
- **Steps:** Call `adherence_stats` for a patient the caller is not linked to.
- **Expected:** Empty result (RLS constrains the RPC to permitted patients).

#### TC-ADH-INT-001 — Adherence reflects a new confirm
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Patient confirms a dose; caregiver reopens adherence.
- **Expected:** Taken count and % update to include the newly taken dose (patient-local day bucket).

---

# M12 — Messaging (Caregiver ↔ Patient)

**Screen:** `messages/[patientId].tsx`, `message/[messageId].tsx`. **Service:** `messages.ts`. **Store:** `outboxStore.ts`.

#### TC-MSG-FUNC-001 — Send a message and see it in the thread
- **Priority:** P2 · **Severity:** Medium
- **Steps:** As `caregiver1` open a patient's thread; type text; tap send.
- **Expected:** The message appears right-aligned (mine) with a timestamp and a "sent" receipt (✓). The composer clears.

#### TC-MSG-FUNC-002 — Receipts progress sent → delivered → read
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Send a message; have the patient receive/open it.
- **Expected:** The caregiver's message receipt updates from ✓ sent to ✓✓ delivered to ✓✓ read (icon + label; never color alone).

#### TC-MSG-FUNC-003 — Opening a thread marks incoming messages read
- **Priority:** P2 · **Severity:** Medium
- **Steps:** With unread incoming messages, open the thread.
- **Expected:** Incoming messages are marked read (mark-thread-read); sender sees read receipts.

#### TC-MSG-NEG-001 — Cannot send empty/whitespace message
- **Steps:** Tap send with an empty or whitespace-only draft.
- **Expected:** Send is disabled / no-op; no row created.

#### TC-MSG-BOUND-001 — Max message length 2000
- **Priority:** P3 · **Severity:** Low
- **Steps:** Enter 2000 characters (accepted) and attempt beyond.
- **Expected:** Input caps at 2000 (`maxLength`); message sends.

#### TC-MSG-EDGE-001 — Duplicate send is exactly-once
- **Priority:** P1 · **Severity:** High
- **Steps:** Send a message where the response is lost and the client retries the same `client_id` (simulate via outbox replay).
- **Expected:** Exactly one message exists server-side (UNIQUE(sender_id, client_id); a retry returns success, not an error or duplicate).

#### TC-MSG-AUTH-001 — Non-member cannot read/post to a thread
- **Priority:** P1 · **Severity:** Critical
- **Steps:** As a user who is neither the patient nor the caregiver of a pair, attempt via API to read `getThread` or insert a message for that pair.
- **Expected:** Empty read; insert denied by RLS.

#### TC-MSG-INT-001 — Realtime delivery while thread open
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Both members have the thread open; one sends.
- **Expected:** The other sees the new bubble appear live (realtime), auto-scrolled to the end.

#### TC-MSG-INT-002 — Message push deep link
- **Priority:** P2 · **Severity:** Medium (standalone build)
- **Steps:** Recipient (backgrounded) receives a message push; taps it.
- **Expected:** App opens `message/[messageId]`; the message + sender name load. Push body contains **no** message text/PHI beyond what's permitted (verify payload carries `message_id`).

---

# M13 — Offline / Sync (Outbox)

**Stores:** `outboxStore.ts` (messages), `confirmOutboxStore.ts` (confirms). **Hook:** `useOutboxFlusher`. Backoff: `2^attempts` s capped at 60s.

#### TC-OFF-FUNC-001 — Offline confirm queues and replays on reconnect
- **Priority:** P1 · **Severity:** Critical
- **Steps:** Enable airplane mode; on a reminder tap confirm; observe optimistic taken state; re-enable network.
- **Expected:** Confirm is enqueued (with the original tap time) and the UI stays "taken"; on reconnect the outbox flushes and the event is recorded `taken` with the **original** `taken_time`, not the reconnect time.

#### TC-OFF-FUNC-002 — Offline message queues with banner
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Airplane mode; send a message in a thread.
- **Expected:** A "queued/pending" banner appears; the bubble shows a "queued offline" label. On reconnect it sends and the receipt becomes ✓ sent.

#### TC-OFF-EDGE-001 — App killed with queued entry survives
- **Priority:** P1 · **Severity:** High
- **Steps:** Queue an offline confirm/message; force-kill the app while offline; relaunch; restore network.
- **Expected:** The persisted queue (AsyncStorage) replays after relaunch; the action completes exactly once (no loss, no double-send).

#### TC-OFF-EDGE-002 — Permanent failure drops the entry
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Queue a message, then revoke the relationship (permission failure) before flush; trigger flush.
- **Expected:** The entry is dropped (not retried forever); a warning is logged; no crash. Network errors, by contrast, are retried with backoff.

#### TC-OFF-BOUND-001 — Exponential backoff cap
- **Priority:** P3 · **Severity:** Low
- **Steps:** Keep the network down across several flush attempts; observe `next_attempt_at` growth.
- **Expected:** Backoff grows 2^attempts seconds and caps at 60s; the pass stops early on the first network failure (later entries would fail identically).

#### TC-OFF-EDGE-003 — Concurrent flush guard
- **Priority:** P3 · **Severity:** Low
- **Steps:** Trigger reconnect and app-start flush near-simultaneously.
- **Expected:** Only one flush pass runs at a time (`flushing` guard); no double-processing.

---

# M14 — Notifications (Push, Channels, Deep Links, PHI)

**Root:** `app/_layout.tsx` (tap handler). **Services:** `notifications/channels.ts`, `registration.ts`. **Edge:** `medication-scheduler`, `caregiver-alert`, `send-push`. Requires a **standalone/EAS build**.

#### TC-NOTIF-FUNC-001 — Push token registration
- **Priority:** P2 · **Severity:** High
- **Steps:** On a standalone build, grant notification permission at first run.
- **Expected:** A `push_tokens` row is created for the user (platform ios/android). Multiple devices create multiple rows (unique per user+token).

#### TC-NOTIF-FUNC-002 — Reminder push deep-link routing
- **Priority:** P1 · **Severity:** High
- **Steps:** Receive a reminder push (data.type = "reminder", event_id); tap it in foreground, background, and terminated states.
- **Expected:** Each state routes to `reminder/[eventId]` without crashing (NF-03). Alert push (type "alert") routes to caregiver alerts; message push (type "message") routes to `message/[messageId]`.

#### TC-NOTIF-SEC-001 — No PHI in push payload
- **Priority:** P1 · **Severity:** Critical · **Requirement:** NF-08
- **Steps:** Capture the `send-push` request body / delivered notification for a reminder and for a caregiver alert.
- **Expected:** Body contains only IDs (event_id / patient_id / message_id) and generic localized title/body — **no** medication name, dosage, or patient name.

#### TC-NOTIF-INT-001 — Missed dose triggers caregiver alert + push
- **Priority:** P1 · **Severity:** Critical · **Requirement:** C-11
- **Steps:** Let a pending dose pass `scheduled_time` + 30 min without confirmation; run the scheduler (marks missed); the DB webhook fires `caregiver-alert`.
- **Expected:** One `alerts` row per active caregiver (type `missed`) and one push each. Re-firing the webhook does not create duplicate alerts (UNIQUE caregiver_id/event_id/alert_type, ignoreDuplicates).

#### TC-NOTIF-INT-002 — Snooze-limit triggers caregiver alert
- **Priority:** P1 · **Severity:** Critical · **Requirement:** C-12
- **Steps:** Snooze a dose until `snooze_count` reaches 3.
- **Expected:** At the transition to 3 (old < 3), a `snoozed_limit` alert + push is created for each active caregiver; not re-created on further updates.

#### TC-NOTIF-INT-003 — Notification copy localized per recipient
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Set one caregiver `language='he'` and another `='en'`; trigger an alert to both.
- **Expected:** Each receives title/body in their own language (per-recipient `users.language`).

#### TC-NOTIF-EDGE-001 — Failed push retried next cron
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Simulate `send-push` failure for a reminder event.
- **Expected:** `notified_at` stays null; the event is retried on the next scheduler run (no duplicate once it eventually succeeds — `notified_at` guard).

#### TC-NOTIF-FUNC-003 — Android notification channels
- **Priority:** P2 · **Severity:** Medium · **Requirement:** P-08
- **Steps:** On Android standalone build, inspect notification channels.
- **Expected:** A `medications` channel (high importance / full-screen intent for lock-screen reminders) and an `alerts` channel exist.

> **Environment note:** All M14 cases require a standalone/EAS build. On Expo Go (SDK 53+) remote push is unavailable — mark such runs **Not Applicable (env)**, do not FAIL.

---

# M15 — Backend / Database / RLS (Manual, via Supabase Studio / psql / API)

**Migrations:** schema, functions, RLS. Use an authenticated JWT (anon key) for RLS tests and service role only for inspection.

### RLS / Authorization

#### TC-RLS-SEC-001 — Patient data isolation across caregivers
- **Priority:** P1 · **Severity:** Critical · **Requirement:** NF-09
- **Steps:** As `caregiver2` (not linked to `patient1`), query `medications`, `medication_events`, `medication_schedules`, `alerts`, `messages` filtered to `patient1`.
- **Expected:** All return zero rows. `is_caregiver_for` is false, so RLS hides everything.

#### TC-RLS-SEC-002 — Patient can only update own events
- **Priority:** P1 · **Severity:** Critical
- **Steps:** As `patient1`, attempt to update another patient's `medication_events` row.
- **Expected:** Denied (policy `events_update_patient` requires `patient_id = auth.uid()`).

#### TC-RLS-SEC-003 — Caregiver cannot insert medication_events or alerts
- **Priority:** P1 · **Severity:** High
- **Steps:** As any client (anon/authenticated), attempt to INSERT into `medication_events` or `alerts`.
- **Expected:** Denied (no client INSERT policy; those are service-role-only via Edge Functions).

#### TC-RLS-SEC-004 — Caregiver reads only own alerts
- **Priority:** P1 · **Severity:** High
- **Steps:** As `caregiver1`, query alerts; attempt to read `caregiver2`'s alerts.
- **Expected:** Only own alerts (`caregiver_id = auth.uid()`); others hidden.

#### TC-RLS-SEC-005 — Users table visibility
- **Priority:** P2 · **Severity:** High
- **Steps:** As `caregiver1`, select from `users`.
- **Expected:** Sees own profile + linked (active) patients + caregivers linked to them as patient — not arbitrary users.

### Immutability / Data integrity

#### TC-DB-SEC-001 — medication_events DELETE is blocked for all roles
- **Priority:** P1 · **Severity:** Critical · **Requirement:** L-03
- **Steps:** Attempt DELETE on a `medication_events` row as authenticated **and** as service role.
- **Expected:** Rejected by the `medication_events_no_delete` trigger ("immutable audit log"), even for service role.

#### TC-DB-SEC-002 — medication_events identity columns are frozen
- **Priority:** P1 · **Severity:** Critical
- **Steps:** Attempt to UPDATE `id`, `schedule_id`, `medication_id`, `patient_id`, `scheduled_time`, or `created_at`.
- **Expected:** Rejected by the immutability trigger. Only `status`, `taken_time`, `snooze_count`, `notes` may change.

#### TC-DB-INT-001 — handle_new_user creates profile on signup
- **Priority:** P1 · **Severity:** High
- **Steps:** Register a new user with name + role metadata; inspect `public.users`.
- **Expected:** A matching row with the correct email, name, and role.

#### TC-DB-EDGE-001 — Signup with missing/invalid role metadata
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Create an auth user with no/invalid `role` metadata (e.g., via admin API).
- **Expected:** Profile is still created; role defaults to `patient`; name derived from the email local-part (or "User"); idempotent (ON CONFLICT updates).

#### TC-DB-INT-002 — Scheduler idempotency (no duplicate events)
- **Priority:** P1 · **Severity:** High
- **Steps:** Run `medication-scheduler` twice in a row for the same window.
- **Expected:** The second run creates no duplicate events (`new_events = 0`); UNIQUE(schedule_id, scheduled_time) + ignoreDuplicates.

#### TC-DB-INT-003 — snooze_event RPC atomic increment
- **Priority:** P1 · **Severity:** High
- **Steps:** Call `snooze_event` for a pending/snoozed event; then for a taken event.
- **Expected:** Pending/snoozed → returns the updated row with `snooze_count+1` and status snoozed. Taken/missed → returns null (not snoozable), no change.

#### TC-DB-INT-004 — Deactivated medication still resolves in history
- **Priority:** P2 · **Severity:** Medium · **Requirement:** L-03
- **Steps:** Deactivate a medication that has historical events; open patient history / adherence.
- **Expected:** Past events still show the medication name/dosage (soft delete, FK preserved).

#### TC-DB-BOUND-001 — CHECK constraints
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Attempt to insert: schedule with `end_date < start_date`; `times_of_day = '{}'`; event `snooze_count = -1`; relationship with `patient_id = caregiver_id`; user `language = 'fr'`.
- **Expected:** Each is rejected by its CHECK constraint.

#### TC-DB-INT-005 — Uniqueness constraints
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Attempt duplicate inserts for: `messages(sender_id, client_id)`, `alerts(caregiver_id, event_id, alert_type)`, `patient_caregiver_relationships(patient_id, caregiver_id)`, `users.email`, `push_tokens(user_id, token)`.
- **Expected:** Second insert violates the unique constraint (23505) and is handled appropriately by the caller (message → treated as success; invite → revive/conflict).

### Manual API (RPC / Edge Function)

#### TC-API-FUNC-001 — email_exists RPC
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Call `email_exists` (anon) with a registered and an unregistered email (lower-cased).
- **Expected:** true / false respectively.

#### TC-API-FUNC-002 — find_patient_id_by_email RPC
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Call with a patient email and with a caregiver email.
- **Expected:** Returns the patient id for a patient; null for a non-patient / unknown email (role='patient' only).

#### TC-API-FUNC-003 — medication-scheduler method handling
- **Priority:** P3 · **Severity:** Low
- **Steps:** Call the scheduler with GET, POST, and an unsupported method (e.g., DELETE).
- **Expected:** GET/POST return a JSON result summary; unsupported → 405. Response includes `{ processed, new_events, notifications_sent, marked_missed }`.

#### TC-API-NEG-001 — caregiver-alert ignores non-matching payloads
- **Priority:** P2 · **Severity:** Medium
- **Steps:** POST a webhook payload that is not an UPDATE on `medication_events`, or missing old_record, or without a trigger condition.
- **Expected:** Responds `{ skipped: true }` with no alerts created. Invalid JSON → 400; non-POST → 405.

---

# M16 — Accessibility & Internationalization / RTL

Cross-cutting; complements per-screen A11Y cases above.

#### TC-A11Y-001 — Patient font-size minimums
- **Priority:** P1 · **Severity:** High · **Requirement:** P-12
- **Steps:** Inspect the ReminderCard and history.
- **Expected:** Medication name ≈48sp; body ≥24sp (base). With the in-app text-size stepper and OS font scale, text scales up without clipping critical content.

#### TC-A11Y-002 — Touch target minimums
- **Priority:** P1 · **Severity:** High · **Requirement:** P-15
- **Steps:** Measure interactive controls.
- **Expected:** Interactive elements ≥48×48dp; patient primary buttons ≥80dp height.

#### TC-A11Y-003 — Color never the sole state indicator
- **Priority:** P2 · **Severity:** Medium · **Requirement:** ui-guidelines
- **Steps:** Review history status, message receipts, adherence tone, alerts, and settings selection.
- **Expected:** Every state pairs color with an icon and/or text/checkmark.

#### TC-A11Y-004 — High-contrast theme across patient screens
- **Priority:** P2 · **Severity:** Medium · **Requirement:** P-13, NF-13
- **Steps:** Enable high contrast; review reminder, history, invitations, settings.
- **Expected:** All patient screens honor the high-contrast palette with adequate contrast.

#### TC-I18N-001 — Hebrew RTL layout
- **Priority:** P1 · **Severity:** High
- **Steps:** Switch language to Hebrew.
- **Expected:** Copy is Hebrew; layout mirrors to RTL (directional arrows/badges via `rtl` util); no clipped/overlapping text.

#### TC-I18N-002 — Language autonyms untranslated
- **Priority:** P3 · **Severity:** Low
- **Steps:** Open the language switcher in either language.
- **Expected:** "עברית" and "English" always display in their own script regardless of current language.

#### TC-I18N-003 — Switch language mid-flow
- **Priority:** P2 · **Severity:** Medium
- **Steps:** Start a flow (e.g., add medication), switch language via settings, return.
- **Expected:** UI re-renders in the new language without crash or loss of entered data where the screen persists.

---

# Traceability Summary (Feature → Business Behavior → Test Type → Cases)

| Requirement | Behavior | Representative cases |
|---|---|---|
| P-01…P-09 | Reminder receive/confirm/snooze, lock-screen, snooze limit | TC-REM-FUNC-001..005, TC-REM-BOUND-001, TC-NOTIF-FUNC-002 |
| P-10…P-11 | History | TC-HIST-FUNC-001, TC-HIST-BOUND-001 |
| P-12…P-18, NF-12..14 | Accessibility | TC-A11Y-001..004, TC-REM-A11Y-001..002 |
| C-01…C-06 | Meds/Schedules CRUD, frequencies | TC-MED-FUNC-001..003, TC-SCH-FUNC-001..004 |
| C-07…C-10 | Invite / accept / revoke | TC-PAT-FUNC-001..003, TC-INV-FUNC-001..002 |
| C-11…C-18 | Alerts, dashboard, adherence, badges | TC-NOTIF-INT-001..002, TC-ALT-FUNC-001..003, TC-ADH-FUNC-001, TC-DASH-FUNC-001..002 |
| M-01…M-03 | Multi-caregiver | TC-PAT-INT-001 |
| L-01…L-04 | Event logging/immutability | TC-DB-SEC-001..002, TC-DB-INT-002, TC-SCH-INT-001 |
| A-01…A-05 | Auth | TC-AUTH-FUNC-001..009, TC-AUTH-NEG-001..008 |
| NF-08 | PHI-free push | TC-NOTIF-SEC-001 |
| NF-09 | RLS isolation | TC-RLS-SEC-001..005, TC-MED-AUTH-001, TC-MSG-AUTH-001 |
| NF-10 | No service_role in client | TC-AUTH-SEC-001 |

---

# Final Gap Analysis

**Fully covered (manually):** Authentication; patient reminder/confirm/snooze; history; invitations; settings; caregiver dashboard; medications/schedules CRUD + validation; patient management; alerts; adherence; messaging; offline outbox; RLS isolation; event immutability; RPC/Edge-function behavior via effects.

**Partially covered:**
- **M14 Notifications** — deep-link, channels, and delivery require a **standalone/EAS build**; unavailable in Expo Go (SDK 53+). Where a push build is not available, these cases are **Not Applicable (env)**, not failures. Real end-to-end FCM/APNs delivery latency (NF-01 "within 60s") can be spot-checked but not guaranteed manually.
- **Realtime reconnect** (NF-06) — observable manually (airplane-mode toggle) but timing is non-deterministic.

**Not covered / Not manually feasible:**
- **NF-15 / NF-16 scalability** (10k patients, 50k events/day; stateless horizontal scaling) — requires load tooling; out of manual scope. **Gap — recommend future automated load testing.**
- **NF-04 cold-start < 3s** and **NF-05 large-list performance** — can be spot-checked but not precisely measured manually. **Recommend instrumentation/automation.**
- **WCAG 2.1 AA contrast ratios (NF-13)** — visual check only; recommend a contrast-analyzer tool pass.

**Needs Clarification:**
- **Email enumeration** is an **intentional** product decision (`emailExists` / `email_exists` RPC, forgot-password "no account" message). Verify behavior matches the documented decision and confirm with the product owner that the enumeration trade-off remains acceptable for production. (Flagged as a security consideration, not a defect.)
- **Snooze duration semantics** — the UI offers 15/30/60 min, but the snooze duration is not passed to the backend (the Edge Function uses a default); confirm whether the selected duration is intended to affect re-fire timing. (`onSnooze(minutes)` currently ignores `minutes` for the mutation.)
- **Reset-password `type=recovery` while already signed in** as a different user — confirm expected behavior.

**High-risk areas to prioritize in every regression:** RLS isolation, PHI-free push, event immutability, snooze-limit/missed alert timing, and offline confirm exactly-once.

---

## Execution Summary Template (per cycle)

| Field | Value |
|---|---|
| Build / commit | |
| Environment (Expo Go / standalone) | |
| Backend (local / staging) | |
| Cases planned / executed / passed / failed / blocked / N-A | |
| Open Critical/High defects | |
| Sign-off (QA) | |
