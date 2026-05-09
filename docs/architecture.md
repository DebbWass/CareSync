# CareSync — System Architecture

**Version:** 1.0  
**Date:** 2026-05-09

---

## 1. Architecture Overview

CareSync follows a **client-backend architecture** with a managed Backend-as-a-Service (BaaS) layer. The mobile app communicates directly with Supabase for database operations and real-time updates. Scheduled background work (notification generation, caregiver alerts) runs in Supabase Edge Functions.

```
┌─────────────────────────────────────────────────────────┐
│                   CareSync Mobile App                    │
│            (React Native + Expo, TypeScript)             │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │   Patient Side       │  │   Caregiver Side         │  │
│  │   /(patient)/        │  │   /(caregiver)/          │  │
│  │                      │  │                          │  │
│  │  • Fullscreen        │  │  • Dashboard             │  │
│  │    reminder UI       │  │  • Medication CRUD       │  │
│  │  • Confirm / Snooze  │  │  • Schedule CRUD         │  │
│  │  • Med history       │  │  • Adherence reports     │  │
│  │                      │  │  • Alert inbox           │  │
│  └──────────┬───────────┘  └──────────┬───────────────┘  │
└─────────────┼──────────────────────────┼─────────────────┘
              │   @supabase/supabase-js   │
              ▼                          ▼
┌─────────────────────────────────────────────────────────┐
│                        Supabase                          │
│                                                          │
│  ┌──────────────────┐   ┌────────────────────────────┐   │
│  │   PostgreSQL     │   │   Auth (JWT + RLS)         │   │
│  │                  │   │                            │   │
│  │  users           │   │  Row-Level Security:       │   │
│  │  medications     │   │  • Patients see own rows   │   │
│  │  schedules       │   │  • Caregivers see linked   │   │
│  │  events          │   │    patients' rows only     │   │
│  │  alerts          │   │  • No cross-patient leaks  │   │
│  │  push_tokens     │   └────────────────────────────┘   │
│  │  relationships   │                                     │
│  └──────────────────┘   ┌────────────────────────────┐   │
│                          │   Realtime (WebSocket)     │   │
│                          │                            │   │
│                          │  • Patient subscribes to   │   │
│                          │    medication_events       │   │
│                          │  • Caregiver subscribes to │   │
│                          │    alerts                  │   │
│                          └────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │   Edge Functions (Deno)                             │  │
│  │                                                     │  │
│  │  medication-scheduler (cron: every 5 minutes)       │  │
│  │  → queries active schedules                         │  │
│  │  → creates medication_events for upcoming doses     │  │
│  │  → sends push notification to patient devices       │  │
│  │                                                     │  │
│  │  caregiver-alert (Database Webhook trigger)         │  │
│  │  → fires on medication_events UPDATE                │  │
│  │  → creates alerts row for each active caregiver     │  │
│  │  → sends push notification to caregiver devices     │  │
│  │                                                     │  │
│  │  send-push (HTTP endpoint)                          │  │
│  │  → accepts user_id + payload                        │  │
│  │  → looks up push_tokens for user                    │  │
│  │  → sends via FCM HTTP v1 / APNs HTTP/2              │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
              │                          │
           FCM/APNs                  FCM/APNs
              │                          │
    ┌─────────▼────────┐      ┌──────────▼───────────┐
    │  Patient Device  │      │  Caregiver Device(s) │
    │                  │      │                      │
    │  Fullscreen      │      │  Alert notification  │
    │  reminder lock   │      │  + Alert inbox badge │
    │  screen          │      │  update (Realtime)   │
    └──────────────────┘      └──────────────────────┘
```

---

## 2. Mobile App Architecture

### 2.1 Role-Based Routing

The app uses a **single codebase with role-based route groups** via Expo Router. After authentication, the root layout (`app/_layout.tsx`) reads the user's role from Zustand (`authStore`) and redirects:

- `role === 'patient'` → `/(patient)/` route group
- `role === 'caregiver'` → `/(caregiver)/` route group
- No session → `/(auth)/` route group (login/register)

This prevents a patient from ever accessing caregiver screens and vice versa.

### 2.2 State Management

Two state layers are used together:

**Zustand** (client-side persistent state):
- `authStore` — user session, profile, role (persisted via AsyncStorage)
- `settingsStore` — accessibility preferences: font scale, high-contrast mode (persisted)
- `patientStore` — which patient is currently selected (for caregivers managing multiple patients)

**TanStack Query** (server state):
- Handles all Supabase data fetching with automatic caching, background refetch, and stale-while-revalidate
- Optimistic updates for medication event confirmations (instant UI feedback)
- Realtime subscription invalidates queries when data changes

### 2.3 Notification Architecture (Mobile Side)

On app startup, `_layout.tsx` runs:
1. `registerForPushNotifications()` → requests permission, gets FCM/APNs token
2. Token saved to `push_tokens` table in Supabase
3. Foreground notification handler: shows in-app banner + navigates to reminder screen
4. Background notification handler: system handles display; tap deep-links to `/(reminder)/[eventId]`
5. On device reboot: token re-registration runs on next app open (no persistent local scheduler needed — all scheduling is server-side)

### 2.4 Data Flow — Medication Confirmation

```
Patient taps "Medication Taken"
        │
        ▼
Optimistic update: event.status = 'taken' (instant UI)
        │
        ▼
supabase.from('medication_events')
  .update({ status: 'taken', taken_time: new Date() })
  .eq('id', eventId)
        │
        ▼
Supabase RLS validates: patient_id = auth.uid() ✓
        │
        ▼
Row updated in PostgreSQL
        │
        ▼
Caregiver's Realtime subscription receives change
        │
        ▼
Caregiver dashboard: adherence % updates live
```

---

## 3. Backend Architecture

### 3.1 Why Supabase (not Firebase)

Firebase (Firestore) uses a document/collection NoSQL model. CareSync's data model is fundamentally relational:

- A `medication_event` belongs to a `medication_schedule` which belongs to a `medication` which belongs to a `patient`
- Adherence queries JOIN across 3-4 tables: `SELECT COUNT(*) FROM events JOIN medications WHERE patient_id = X AND status = 'taken' AND scheduled_time BETWEEN Y AND Z`
- Row-Level Security (RLS) in PostgreSQL enforces patient/caregiver isolation at the database level — impossible to implement equivalently in Firestore without application-level enforcement (which is error-prone)

Supabase gives us PostgreSQL's full relational power with the developer experience of Firebase.

### 3.2 Edge Function: medication-scheduler

**Trigger:** Supabase cron job, every 5 minutes  
**Purpose:** Generate `medication_events` rows for upcoming doses and send push notifications

```
1. Query active medication_schedules (is_active = true, end_date IS NULL or end_date >= today)
2. For each schedule, calculate the next N scheduled times within the next 24 hours
3. For each time not yet in medication_events (idempotent check via UNIQUE on schedule_id + scheduled_time):
   a. INSERT medication_events row (status = 'pending')
   b. Look up push_tokens for the patient
   c. Call send-push Edge Function for each device token
4. Mark overdue events (scheduled_time + 30min < now, status = 'pending') as 'missed'
5. For any newly-missed event: trigger caregiver-alert
```

**Idempotency:** The unique constraint on `(schedule_id, scheduled_time)` ensures running the function multiple times never creates duplicate events.

### 3.3 Edge Function: caregiver-alert

**Trigger:** Supabase Database Webhook on `medication_events` table UPDATE  
**Fires when:** `status` changes to `missed`, OR `snooze_count` reaches `SNOOZE_LIMIT` (3)

```
1. Validate the trigger payload (confirm it's a relevant status change)
2. Query patient_caregiver_relationships WHERE patient_id = event.patient_id AND status = 'active'
3. For each active caregiver:
   a. INSERT alerts row (alert_type = 'missed' or 'snoozed_limit')
   b. Call send-push for each of the caregiver's registered devices
```

### 3.4 Edge Function: send-push

**Trigger:** HTTP POST (called by other Edge Functions)  
**Purpose:** Centralized push notification delivery

```typescript
// Request body
{ user_id: string, title: string, body: string, data: { event_id: string } }

// Steps:
1. Query push_tokens WHERE user_id = payload.user_id
2. For Android tokens: send via FCM HTTP v1 API
3. For iOS tokens: send via APNs HTTP/2
4. Log delivery result (for observability)
```

**CRITICAL:** `body` must never contain PHI. The `data.event_id` field is used by the app to fetch details.

---

## 4. Security Architecture

### 4.1 Authentication Flow

```
User opens app
    │
    ▼
supabase.auth.getSession() → valid session?
    │
    ├── YES → read role from authStore (or re-fetch from users table)
    │          → redirect to /(patient)/ or /(caregiver)/
    │
    └── NO → redirect to /(auth)/login
              │
              ▼
         User logs in → Supabase returns JWT
              │
              ▼
         JWT stored in AsyncStorage (encrypted)
              │
              ▼
         Auth state listener fires → authStore updated
              │
              ▼
         Role-based redirect
```

### 4.2 Authorization — Row-Level Security

Every database operation from the mobile client passes through RLS. The `anon` key (public, in the app bundle) only allows what RLS permits:

| Operation | Who | RLS Policy |
|---|---|---|
| Read own profile | Patient/Caregiver | `id = auth.uid()` |
| Read patient profile | Caregiver | `is_caregiver_for(id) = true` |
| Read medications | Patient | `patient_id = auth.uid()` |
| Read medications | Caregiver | `is_caregiver_for(patient_id) = true` |
| Write medications | Caregiver | `is_caregiver_for(patient_id) = true` |
| Update event status | Patient | `patient_id = auth.uid()` |
| Read events | Caregiver | `is_caregiver_for(patient_id) = true` |
| Read alerts | Caregiver | `caregiver_id = auth.uid()` |
| Write push tokens | Any user | `user_id = auth.uid()` |

### 4.3 PHI Protection

- Push notification payloads contain only `event_id` (UUID)
- App fetches medication details from Supabase after notification tap (over TLS)
- No PHI in Sentry crash reports (`beforeSend` scrubs name, email, medication data)
- No PHI in console logs (development or production)

---

## 5. Realtime Architecture

Two Supabase Realtime subscriptions are maintained:

**Patient app:**
```typescript
supabase
  .channel('patient-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'medication_events',
    filter: `patient_id=eq.${userId}`
  }, handleNewEvent)
  .subscribe()
```
When a new `pending` event is inserted (by the scheduler), the patient's reminder screen updates immediately — even if the push notification was delayed.

**Caregiver app:**
```typescript
supabase
  .channel('caregiver-alerts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'alerts',
    filter: `caregiver_id=eq.${userId}`
  }, handleNewAlert)
  .subscribe()
```
New alerts increment the unread badge count in real time without requiring a manual refresh.

---

## 6. Deployment Architecture

```
Developer machine
    │ git push → feature branch
    ▼
GitHub
    │ PR opened → CI workflow
    ▼
GitHub Actions CI
    ├── TypeScript type-check
    ├── ESLint
    └── (Phase 6+) Jest tests

    │ PR merged to develop
    ▼
GitHub Actions EAS Preview
    └── EAS Build → preview APK/IPA → internal testers

    │ PR merged to main
    ▼
GitHub Actions EAS Production
    └── EAS Build → production AAB/IPA

    │ Manual submission
    ▼
Google Play Store / Apple App Store
```

Supabase migrations are applied separately:
- Local development: `supabase db reset` (uses Docker)
- Production: `supabase db push` (run manually or via CI before app release)
