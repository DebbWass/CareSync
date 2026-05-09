# CareSync — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-05-09  
**Status:** Approved

---

## 1. Product Overview

CareSync is a mobile application that helps elderly patients (specifically those with Alzheimer's disease or other memory impairments) take their medications reliably, while giving remote caregivers full visibility and control over medication management.

### Problem Statement

Elderly patients with Alzheimer's disease frequently forget to take medications, take the wrong dose, or are unaware of the correct schedule. Caregivers who do not live with the patient have no reliable way to know whether medications were taken, and cannot intervene in real time when a dose is missed.

### Solution

A dual-sided mobile app:
1. **Patient App** — an always-present, impossible-to-ignore medication reminder system with accessibility-first design
2. **Caregiver App** — a full remote management and monitoring dashboard with real-time alerts

---

## 2. Users and Roles

### 2.1 Patient (Elderly User)

- Typically 65+ years old
- May have cognitive impairment (Alzheimer's, dementia)
- Limited smartphone experience
- May have visual or motor impairments
- Uses the app primarily to receive and confirm medication reminders

### 2.2 Caregiver (Family Member / Medical Caregiver)

- Manages one or more patients remotely
- Comfortable with smartphones
- Responsible for creating medication schedules
- Needs real-time alerts and historical adherence data

### 2.3 System Roles

| Role | Permissions |
|---|---|
| `patient` | View own reminders, confirm/snooze medications, view own history |
| `caregiver` | Full medication and schedule management for linked patients, view adherence, receive alerts |

---

## 3. Functional Requirements

### 3.1 Patient — Medication Reminder

| ID | Requirement | Priority |
|---|---|---|
| P-01 | Patient receives a push notification when a medication is due | Must Have |
| P-02 | Notification opens a fullscreen reminder screen that cannot be accidentally dismissed | Must Have |
| P-03 | Fullscreen reminder shows: medication name, dosage, instructions, scheduled time | Must Have |
| P-04 | Patient can confirm the medication was taken with a single large button | Must Have |
| P-05 | Patient can snooze the reminder (options: 15 min, 30 min, 60 min) | Must Have |
| P-06 | Snooze button shows how many snoozes remain before caregiver is alerted | Should Have |
| P-07 | Reminder reappears after the snooze period expires | Must Have |
| P-08 | Reminder must appear on the lock screen (full-screen intent on Android) | Must Have |
| P-09 | App stays visible until the patient takes an action (confirm or snooze) | Must Have |

### 3.2 Patient — History

| ID | Requirement | Priority |
|---|---|---|
| P-10 | Patient can view their own medication history (taken, missed, snoozed) | Should Have |
| P-11 | History shows the scheduled time, actual taken time, and status | Should Have |

### 3.3 Patient — Accessibility

| ID | Requirement | Priority |
|---|---|---|
| P-12 | All text sizes are large enough for visually impaired users (min 24sp body, 48sp medication name) | Must Have |
| P-13 | High-contrast mode is available and toggleable | Must Have |
| P-14 | All interactive elements have accessibility labels and hints | Must Have |
| P-15 | Touch targets are at minimum 48×48dp (primary buttons 80dp height) | Must Have |
| P-16 | App is compatible with TalkBack (Android) and VoiceOver (iOS) | Must Have |
| P-17 | Portrait orientation locked (prevents accidental rotation) | Should Have |
| P-18 | No animations that could trigger photosensitivity issues | Should Have |

### 3.4 Caregiver — Medication Management

| ID | Requirement | Priority |
|---|---|---|
| C-01 | Caregiver can add a medication (name, dosage, instructions) for a linked patient | Must Have |
| C-02 | Caregiver can edit a medication | Must Have |
| C-03 | Caregiver can deactivate (soft-delete) a medication | Must Have |
| C-04 | Caregiver can create a schedule for a medication (frequency, times of day, date range) | Must Have |
| C-05 | Caregiver can edit or deactivate a schedule | Must Have |
| C-06 | Supported frequency types: daily, twice daily, three times daily, weekly, custom | Must Have |

### 3.5 Caregiver — Patient Management

| ID | Requirement | Priority |
|---|---|---|
| C-07 | Caregiver can link to a patient by sending an invite (by email or invite link) | Must Have |
| C-08 | Patient must accept the invitation before the caregiver gains access | Must Have |
| C-09 | Caregiver can manage multiple patients | Must Have |
| C-10 | Caregiver can revoke their access to a patient | Should Have |

### 3.6 Caregiver — Monitoring and Alerts

| ID | Requirement | Priority |
|---|---|---|
| C-11 | Caregiver receives a push notification when a patient misses a medication (no confirmation within the grace period) | Must Have |
| C-12 | Caregiver receives a push notification when a patient snoozes a medication at or beyond the snooze limit | Must Have |
| C-13 | Caregiver can view an alert inbox with all past and current alerts | Must Have |
| C-14 | Caregiver can mark alerts as read | Must Have |
| C-15 | Caregiver can view a dashboard showing today's adherence summary | Must Have |
| C-16 | Caregiver can view weekly and monthly adherence reports | Should Have |
| C-17 | Caregiver can view the patient's full medication event history | Must Have |
| C-18 | Dashboard shows unread alert count as a badge | Must Have |

### 3.7 Multi-Caregiver Support

| ID | Requirement | Priority |
|---|---|---|
| M-01 | A single patient can have multiple active caregivers | Must Have |
| M-02 | All active caregivers for a patient receive alerts simultaneously | Must Have |
| M-03 | Any caregiver can manage medications and schedules for the patient | Must Have |

### 3.8 Event Logging

| ID | Requirement | Priority |
|---|---|---|
| L-01 | Every scheduled medication dose creates a `medication_event` record | Must Have |
| L-02 | Each event records: scheduled time, actual taken time, status (pending/taken/snoozed/missed), snooze count | Must Have |
| L-03 | Event records are never deleted (immutable audit trail) | Must Have |
| L-04 | Caregiver alert records are stored and queryable | Must Have |

### 3.9 Authentication

| ID | Requirement | Priority |
|---|---|---|
| A-01 | User can register with email and password | Must Have |
| A-02 | User selects their role (patient or caregiver) during registration | Must Have |
| A-03 | User can log in and log out | Must Have |
| A-04 | Session persists across app restarts | Must Have |
| A-05 | Password reset by email is available | Should Have |

---

## 4. Non-Functional Requirements

### 4.1 Reliability

| ID | Requirement |
|---|---|
| NF-01 | Medication reminder push notifications must be delivered within 60 seconds of the scheduled time |
| NF-02 | The system must function if the caregiver has no network connection (patient-side reminders must still fire via locally stored schedule) |
| NF-03 | The app must not crash when a notification is received while the app is in any state (foreground, background, terminated) |

### 4.2 Performance

| ID | Requirement |
|---|---|
| NF-04 | App startup (cold start) must be under 3 seconds on mid-range devices |
| NF-05 | Medication history list must handle 365+ days of events without performance degradation (virtual scrolling) |
| NF-06 | Supabase Realtime subscription must reconnect automatically after network interruption |

### 4.3 Security

| ID | Requirement |
|---|---|
| NF-07 | All API requests use JWT authentication (Supabase RLS) |
| NF-08 | PHI (medication names, patient names, dosages) must never appear in push notification payloads |
| NF-09 | Row-Level Security enforces patient/caregiver data isolation at the database level |
| NF-10 | The service_role Supabase key must never be included in the mobile app bundle |
| NF-11 | All network communication uses TLS 1.2 or higher |

### 4.4 Accessibility

| ID | Requirement |
|---|---|
| NF-12 | WCAG 2.1 Level AA compliance for all patient-facing screens |
| NF-13 | Minimum color contrast ratio of 4.5:1 for all text on background combinations |
| NF-14 | App supports iOS Dynamic Type and Android Font Scale settings |

### 4.5 Scalability

| ID | Requirement |
|---|---|
| NF-15 | Backend must support at least 10,000 patients and 50,000 medication events per day without configuration changes |
| NF-16 | Supabase Edge Functions must be stateless and horizontally scalable |

---

## 5. Out of Scope (Version 1.0)

The following features are intentionally excluded from the first release:

- Voice command medication confirmation
- Apple Watch / Wear OS companion app
- Medication refill tracking and pharmacy integration
- Pill identification via camera
- Video calls between patient and caregiver
- Automatic medication dispensers integration
- Multi-language support (English only for v1)
- Web dashboard for caregivers
- AI-based adherence predictions

These may be considered for future versions.

---

## 6. Constraints

- The patient app must work on Android 10+ and iOS 14+
- Expo Managed Workflow must be used (no custom native modules that break the managed workflow)
- The app must pass App Store Review guidelines (healthcare apps require a privacy policy and may require a medical device classification statement)
- HIPAA compliance goals require that a Business Associate Agreement (BAA) be signed with Supabase (Enterprise tier) before production launch with real patient data
