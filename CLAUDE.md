# CareSync — Claude Code Context

This file gives Claude Code complete context about the CareSync project so every session starts informed.

## Project Purpose

A healthcare mobile app for Alzheimer's/elderly medication management. Two user roles in one app:
- **Patient** — receives fullscreen medication reminders, confirms/snoozes doses
- **Caregiver** — manages medications remotely, receives alerts for missed doses

Personal motivation: the user's father has early-stage Alzheimer's and lives alone.

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile runtime | React Native + Expo Managed Workflow | Expo SDK 54 |
| Language | TypeScript | 5.x |
| Navigation | Expo Router (file-based) | 4.x |
| State (client) | Zustand | 5.x |
| State (server) | TanStack Query (React Query) | v5 |
| UI components | React Native Paper | 5.x |
| Backend | Supabase | latest |
| Database | PostgreSQL (via Supabase) | 15 |
| Auth | Supabase Auth (JWT + RLS) | — |
| Realtime | Supabase Realtime (WebSocket) | — |
| Edge Functions | Supabase Edge Functions (Deno) | — |
| Push notifications | Expo Notifications → FCM/APNs | — |
| Build | Expo EAS | — |
| CI/CD | GitHub Actions | — |

## Repository

- GitHub: https://github.com/DebbWass/CareSync.git
- Branches: `main` (production), `develop` (integration), `feature/xxx`

## Project Structure

```
CareSync/
├── apps/mobile/                 # Expo React Native app
│   ├── app/                     # Expo Router screens (file-based routing)
│   │   ├── _layout.tsx          # Root layout: auth guard + notification handler
│   │   ├── (auth)/              # Login, register — no auth required
│   │   ├── (patient)/           # Patient-role screens
│   │   │   ├── index.tsx        # Fullscreen reminder (patient home)
│   │   │   └── history.tsx      # Medication history
│   │   ├── (caregiver)/         # Caregiver-role screens
│   │   │   ├── index.tsx        # Dashboard
│   │   │   ├── medications/     # Medication CRUD
│   │   │   ├── schedules/       # Schedule CRUD
│   │   │   ├── patients/        # Patient management
│   │   │   └── alerts.tsx       # Alert inbox
│   │   └── reminder/[eventId].tsx  # Deep-link from push notification
│   └── src/
│       ├── types/               # TypeScript interfaces
│       │   ├── index.ts         # Domain types (User, Medication, etc.)
│       │   ├── database.ts      # Supabase auto-generated DB types
│       │   └── notifications.ts # Push notification payload types
│       ├── constants/
│       │   ├── colors.ts        # Theme colors (normal + high-contrast)
│       │   ├── typography.ts    # Font sizes (base + large-text patient mode)
│       │   └── config.ts        # App constants (SNOOZE_LIMIT=3, etc.)
│       ├── lib/
│       │   ├── supabase.ts      # Supabase client singleton
│       │   └── queryClient.ts   # TanStack Query client
│       ├── services/
│       │   ├── supabase/        # DB query functions per domain
│       │   └── notifications/   # Push token registration + handlers
│       ├── hooks/               # Custom React hooks (useAuth, useMedications, etc.)
│       ├── store/               # Zustand stores (authStore, settingsStore)
│       ├── components/
│       │   ├── ui/              # Base design system (Button, Text, Card)
│       │   ├── patient/         # Patient-specific components
│       │   └── caregiver/       # Caregiver-specific components
│       └── utils/               # dateUtils, scheduleUtils, accessibilityUtils
├── supabase/
│   ├── migrations/              # PostgreSQL migrations (apply in order)
│   ├── functions/               # Edge Functions (Deno)
│   │   ├── medication-scheduler/ # Cron: generate events + send push
│   │   ├── send-push/           # HTTP: send push to user
│   │   └── caregiver-alert/     # DB webhook: create alert + notify caregiver
│   └── config.toml
├── docs/                        # All project documentation
└── .github/workflows/           # CI/CD pipelines
```

## Database Schema (7 Tables)

All tables have Row-Level Security (RLS) enabled.

| Table | Key Columns | Notes |
|---|---|---|
| `users` | id (FK auth.users), email, name, role (patient/caregiver), phone | Auto-created by auth trigger |
| `patient_caregiver_relationships` | patient_id, caregiver_id, status (pending/active/revoked) | Multiple caregivers per patient |
| `medications` | patient_id, created_by, name, dosage, instructions, is_active | Soft delete via is_active |
| `medication_schedules` | medication_id, frequency_type, times_of_day (TEXT[]), days_of_week, start_date, end_date | times_of_day = ["08:00","20:00"] |
| `medication_events` | schedule_id, medication_id, patient_id, scheduled_time, taken_time, status (pending/taken/snoozed/missed), snooze_count | **IMMUTABLE — never delete** |
| `alerts` | patient_id, caregiver_id, event_id, alert_type (missed/snoozed_limit/etc), is_read | Caregiver inbox |
| `push_tokens` | user_id, token, platform (ios/android) | Multiple devices per user |

**RLS helper:** `is_caregiver_for(patient_uuid)` — returns true if current auth.uid() is an active caregiver for that patient.

## Key Architectural Rules

1. **PHI in notifications:** Push notification body must NEVER contain medication names, dosages, or patient names. Send only the `event_id` UUID. The app fetches details from Supabase after the user taps.

2. **medication_events is the audit log:** Never run DELETE on this table. Soft-state only (update status column).

3. **service_role key:** Used only in Supabase Edge Functions. The mobile client uses the `anon` key, which is restricted by RLS.

4. **Role-based routing:** After login, `authStore.role` determines the route group. `_layout.tsx` (root) redirects to `/(patient)/` or `/(caregiver)/` based on role.

5. **Snooze limit:** Defined in `src/constants/config.ts` as `SNOOZE_LIMIT = 3`. When `snooze_count >= SNOOZE_LIMIT`, the caregiver-alert Edge Function fires automatically via DB webhook.

6. **Notification channel:** Android requires a notification channel named `medications` with `IMPORTANCE_HIGH` for medication reminders to appear on lock screen.

## Common Development Commands

```powershell
# Mobile app
cd apps/mobile
npx expo start              # Start dev server (scan QR with Expo Go)
npx expo start --ios        # iOS simulator
npx expo start --android    # Android emulator
npx tsc --noEmit            # TypeScript type check
npx eslint . --ext .ts,.tsx # Lint

# Supabase local dev (requires Docker)
supabase start              # Start local Supabase (Postgres + Auth + Edge Functions)
supabase stop               # Stop local Supabase
supabase db reset           # Reset DB and rerun all migrations
supabase db push            # Push migrations to remote (production)
supabase functions serve    # Serve Edge Functions locally
supabase gen types typescript --local > src/types/database.ts  # Regenerate DB types

# Git
git checkout -b feature/your-feature develop   # New feature branch
git push origin feature/your-feature            # Push feature
# Then open PR: feature → develop
```

## Environment Variables

In `apps/mobile/.env.local` (never committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Edge Functions use the `service_role` key set as Supabase secrets (not in .env).

## Accessibility Requirements (Patient App)

The patient side is designed for elderly users who may have Alzheimer's. Non-negotiable:
- Minimum font size: 24sp body, 48sp medication name
- Confirm button: minimum 80dp height, full-width preferred
- All interactive elements: `accessibilityLabel` + `accessibilityHint` required
- High-contrast mode must be toggleable and persisted
- No color as the sole indicator of state (always pair color with icon/text)
- Support TalkBack (Android) and VoiceOver (iOS)

## Notification Flow Summary

1. Supabase Edge Function `medication-scheduler` runs every 5 min (cron)
2. It creates `medication_events` rows for upcoming doses (status=`pending`)
3. It sends push notifications to the patient's devices via FCM/APNs
4. Patient taps notification → deep-links to `caresync://reminder/[eventId]`
5. Patient confirms → event status → `taken`, `taken_time` set
6. Patient snoozes → event status → `snoozed`, `snooze_count++`
7. When `snooze_count >= SNOOZE_LIMIT` OR scheduled_time + 30min passes without `taken`:
   - Supabase DB webhook triggers `caregiver-alert` Edge Function
   - Creates `alerts` row for each active caregiver
   - Sends push notification to all caregiver devices

## Documentation Index

- [Requirements](docs/requirements.md) — Functional + non-functional requirements
- [Architecture](docs/architecture.md) — Full system design
- [DB Schema](docs/db-schema.md) — SQL schema, RLS policies, indexes
- [UI Guidelines](docs/ui-guidelines.md) — Accessibility, colors, typography
- [Notification Flow](docs/notification-flow.md) — End-to-end notification architecture
- [API Reference](docs/api-reference.md) — Edge Function endpoint contracts
- [Deployment](docs/deployment.md) — EAS + Supabase production runbook
