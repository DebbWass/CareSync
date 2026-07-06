# CareSync

A production-grade healthcare mobile application for remote medication management — built for elderly patients with Alzheimer's disease and their caregivers.

## What It Does

**For the Patient (Elderly User)**
- Receives fullscreen medication reminders that cannot be accidentally dismissed
- Confirms medications with one large, accessible button
- Snoozes reminders if not ready (caregiver is automatically notified after repeat snoozes)
- Designed for non-technical users: large text, high contrast, minimal UI

**For the Caregiver (Family Member)**
- Manages medications, dosages, and schedules remotely
- Receives real-time alerts when a patient misses or repeatedly snoozes a medication
- Views adherence history, daily/weekly reports, and patient activity timeline
- Supports multiple caregivers per patient

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK 54 (TypeScript) |
| Navigation | Expo Router (file-based, deep-link aware) |
| State | Zustand 5 + TanStack Query v5 |
| UI | React Native Paper |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Notifications | Expo Push Notifications → FCM / APNs |
| CI/CD | GitHub Actions + Expo EAS |

## Project Structure

```
CareSync/
├── apps/mobile/        React Native Expo app (iOS + Android)
├── supabase/           Database migrations + Edge Functions
├── docs/               Architecture, requirements, UI guidelines
└── .github/workflows/  CI/CD pipelines
```

## Getting Started

### Prerequisites

- Node.js v20+
- npm v10+
- Docker Desktop (for Supabase local dev)
- Expo Go app on your phone (for development testing)

### Setup

```powershell
# 1. Clone the repo
git clone https://github.com/DebbWass/CareSync.git
cd CareSync

# 2. Install mobile app dependencies
cd apps/mobile
npm install

# 3. Copy environment template
cp .env.example .env.local
# Fill in your Supabase URL and anon key

# 4. Start local Supabase (Docker required)
cd ../../
supabase start

# 5. Apply database migrations
supabase db reset

# 6. Start the mobile app
cd apps/mobile
npx expo start
```

### Environment Variables

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Development Workflow

| Branch | Purpose |
|---|---|
| `main` | Production only — protected |
| `develop` | Integration branch |
| `feature/xxx` | Individual features |

All PRs must pass the full CI quality gate before merge: TypeScript
type-check, ESLint (zero warnings), Prettier, Jest unit tests, Deno Edge
Function tests, pgTAP database tests, dependency audit, and an Expo bundle
smoke test.

### Testing & quality commands

```powershell
# Mobile app (run in apps/mobile — or from the repo root via npm run <script>)
npm test                 # Jest unit/component tests
npm run test:coverage    # Jest with coverage report
npm run lint             # ESLint (zero-warning policy)
npm run typecheck        # TypeScript
npm run format           # Prettier write
npm run format:check     # Prettier verify (what CI runs)

# Database (repo root; requires Docker + `supabase start`)
npm run db:reset         # Re-run all migrations + seed
npm run db:test          # pgTAP suite in supabase/tests/
npm run db:types         # Regenerate apps/mobile/src/types/database.ts

# Edge Functions (in supabase/functions; requires Deno)
deno test tests/
```

Local seed accounts (after `npm run db:reset`): `patient@caresync.test` /
`caregiver@caresync.test`, password `Password123!`.

### Internationalization

UI strings live in `apps/mobile/src/i18n/locales/` (`en.json`; Hebrew arrives
with the RTL milestone). Screens use `useTranslation()` — never hardcode
user-facing strings. Language resolution: user setting → device locale →
English fallback.

## Documentation

| Document | Location |
|---|---|
| Requirements | [docs/requirements.md](docs/requirements.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Database Schema | [docs/db-schema.md](docs/db-schema.md) |
| UI Guidelines | [docs/ui-guidelines.md](docs/ui-guidelines.md) |
| Notification Flow | [docs/notification-flow.md](docs/notification-flow.md) |
| API Reference | [docs/api-reference.md](docs/api-reference.md) |
| Deployment | [docs/deployment.md](docs/deployment.md) |

## Development Roadmap

| Phase | Status |
|---|---|
| 1 — Foundation (Git, docs, DB schema, CI) | 🔄 In Progress |
| 2 — Core App (Expo, navigation, auth) | Pending |
| 3 — Patient App (reminder UI, accessibility) | Pending |
| 4 — Caregiver App (management, dashboard) | Pending |
| 5 — Notifications & Alerts | Pending |
| 6 — Testing & Polish | Pending |
| 7 — Deployment (EAS, App Stores) | Pending |

## Security Notes

- All data access is controlled by PostgreSQL Row-Level Security (RLS)
- PHI (Protected Health Information) is never included in push notification payloads
- The `service_role` Supabase key is used only in Edge Functions — never in the client app
- Medication event history is immutable (the audit trail is never deleted)

## License

Private repository. All rights reserved.
