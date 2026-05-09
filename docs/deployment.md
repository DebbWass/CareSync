# CareSync — Deployment Guide

**Version:** 1.0  
**Date:** 2026-05-09

---

## Overview

CareSync uses Expo EAS (Expo Application Services) for mobile app builds and Supabase for backend hosting. This guide covers both local development and production deployment.

---

## Environments

| Environment | Mobile | Backend | Purpose |
|---|---|---|---|
| Local | Expo Go / simulator | Supabase local (Docker) | Day-to-day development |
| Preview | EAS Preview build | Supabase remote (dev project) | Testing before release |
| Production | EAS Production build | Supabase remote (prod project) | Live app store releases |

---

## Local Development Setup

### Prerequisites

- Node.js v20+
- Docker Desktop (running)
- Supabase CLI: `npm install -g supabase`
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Expo Go app on a physical device

### First-Time Setup

```powershell
# 1. Clone repository
git clone https://github.com/DebbWass/CareSync.git
cd CareSync

# 2. Install mobile app dependencies
cd apps/mobile
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with local Supabase credentials (see step 5)

# 4. Start Supabase local stack (requires Docker running)
cd ../../
supabase start
# Output shows: API URL, anon key, service role key, Studio URL

# 5. Copy local credentials to .env.local
# EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>

# 6. Apply database migrations
supabase db reset

# 7. Start the mobile app
cd apps/mobile
npx expo start
# Scan QR code with Expo Go to run on physical device
# Or press 'a' for Android emulator, 'i' for iOS simulator
```

### Daily Development Commands

```powershell
# Start everything
supabase start       # Start local backend (if not running)
cd apps/mobile
npx expo start       # Start Expo dev server

# Type checking
npx tsc --noEmit

# Linting
npx eslint . --ext .ts,.tsx

# Regenerate Supabase types after schema changes
supabase gen types typescript --local > src/types/database.ts

# Reset local DB and re-apply all migrations
supabase db reset

# View local Supabase Studio (DB admin UI)
# Opens at: http://127.0.0.1:54323
```

---

## Supabase Production Setup

### Step 1: Create Supabase Projects

Create two projects at [supabase.com](https://supabase.com):
- `caresync-dev` — for development/preview builds
- `caresync-prod` — for production only

**Settings for both projects:**
- Region: choose closest to your users
- Auth → Email: enable email authentication
- Auth → Email → Confirm email: enable (disable only for local testing)
- Auth → Email → Password security: strong (12+ characters)

### Step 2: Apply Migrations to Remote

```powershell
# Link to development project
supabase link --project-ref YOUR_DEV_PROJECT_REF

# Push all migrations
supabase db push

# Verify in Supabase Dashboard → Table Editor → all 7 tables present

# Link to production project
supabase link --project-ref YOUR_PROD_PROJECT_REF

# Push to production
supabase db push
```

### Step 3: Deploy Edge Functions

```powershell
# Deploy all Edge Functions
supabase functions deploy medication-scheduler
supabase functions deploy send-push
supabase functions deploy caregiver-alert

# Set Edge Function secrets (server-side only — not the anon key)
supabase secrets set FCM_SERVER_KEY=your-fcm-server-key
supabase secrets set APNS_KEY_ID=your-apns-key-id
supabase secrets set APNS_TEAM_ID=your-apple-team-id
supabase secrets set APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

### Step 4: Configure Cron for medication-scheduler

In Supabase Dashboard → Edge Functions → medication-scheduler:
- Enable cron trigger
- Cron expression: `*/5 * * * *` (every 5 minutes)

### Step 5: Configure Database Webhook for caregiver-alert

In Supabase Dashboard → Database → Webhooks:
- Name: `medication_event_alert`
- Table: `medication_events`
- Events: `UPDATE`
- URL: `https://{PROJECT_REF}.supabase.co/functions/v1/caregiver-alert`
- HTTP Headers: `Authorization: Bearer {SERVICE_ROLE_KEY}`

---

## Expo EAS Setup

### Step 1: EAS Login and Project Init

```powershell
cd apps/mobile

# Login to Expo account
eas login

# Initialize EAS (creates eas.json)
eas build:configure
```

### Step 2: eas.json Configuration

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": {}
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services-key.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "your-app-store-connect-app-id"
      }
    }
  }
}
```

### Step 3: Configure Google Services

For FCM push notifications on Android:
1. Create a project in [Firebase Console](https://console.firebase.google.com)
2. Add Android app with package ID `com.caresync.app`
3. Download `google-services.json` → place in `apps/mobile/`
4. Add to `.gitignore` if it contains sensitive keys

For iOS APNs:
1. In Apple Developer Portal → Certificates → Keys → create APNs key
2. Download the `.p8` key file
3. Set in Supabase secrets (not committed to repo)

### Step 4: First Production Build

```powershell
# Android production build (AAB for Play Store)
eas build --platform android --profile production

# iOS production build (IPA for App Store)
eas build --platform ios --profile production

# Builds run in the cloud — no local Xcode/Android Studio needed
# Download the build from https://expo.dev/accounts/{your-account}/projects/caresync/builds
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

**`.github/workflows/ci.yml`** — Runs on every PR and push:
- TypeScript type-check
- ESLint

**`.github/workflows/eas-preview.yml`** — Runs on merge to `develop`:
- EAS preview build (internal testing APK)
- Notifies team via GitHub PR comment with download link

**`.github/workflows/eas-production.yml`** — Runs on merge to `main`:
- EAS production build
- Supabase migration push (optional — can be manual for safety)

### Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `EXPO_TOKEN` | EAS CLI authentication |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI authentication |
| `SUPABASE_PROJECT_REF` | Production project reference |
| `SUPABASE_DB_PASSWORD` | Production DB password (for migrations) |

---

## App Store Submission

### Google Play Store

1. Create app in [Google Play Console](https://play.google.com/console)
2. Package name: `com.caresync.app`
3. Required before submission:
   - Privacy Policy URL
   - Data safety form (declare health data collection)
   - Target age group: General
4. Submit AAB to Internal Testing track first
5. Promote: Internal → Closed Testing → Open Testing → Production

### Apple App Store

1. Create app in [App Store Connect](https://appstoreconnect.apple.com)
2. Bundle ID: `com.caresync.app`
3. Required before submission:
   - Privacy Policy URL (HIPAA-style: explain health data handling)
   - Privacy Nutrition Labels (declare health data)
   - `NSHealthShareUsageDescription` if using HealthKit (not in v1)
4. Submit to TestFlight first
5. Promote: TestFlight Internal → External → App Review

**Healthcare App Review Notes:**
- If Apple classifies CareSync as a medical device app, additional review time applies
- Prepare a reviewer account with test data (demo patient + caregiver)
- Include demo login credentials in App Review Notes

---

## OTA Updates (Over-the-Air)

For JavaScript-only changes (bug fixes, UI tweaks) that don't require a new app store build:

```powershell
# Publish OTA update to all users on production channel
eas update --branch production --message "Fix reminder screen crash"
```

This updates all installed apps instantly without going through app store review. Native code changes (new permissions, native modules) still require a full EAS build.

---

## Production Monitoring

| Tool | Purpose | Setup |
|---|---|---|
| Sentry | Crash reporting + error tracking | `npx expo install sentry-expo` |
| Supabase Dashboard | DB metrics, query performance, auth stats | Built-in |
| EAS Insights | App launch metrics, crash rates | Built-in at expo.dev |
| Supabase Logs | Edge Function execution logs | Dashboard → Logs → Edge Functions |

### Sentry Configuration

```typescript
// apps/mobile/app.json → plugins
["@sentry/react-native/expo", {
  "organization": "your-sentry-org",
  "project": "caresync-mobile"
}]
```

```typescript
// src/lib/sentry.ts — scrub PHI before sending
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    // Remove any user data that could be PHI
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  }
});
```

---

## HIPAA Production Checklist

Before going live with real patient data:

- [ ] Supabase Enterprise HIPAA add-on enabled (provides BAA)
- [ ] Privacy Policy published and linked in app
- [ ] Data retention policy documented (medication events: minimum 6 years)
- [ ] Backup and recovery procedure tested
- [ ] Supabase daily backups enabled (Pro tier minimum)
- [ ] PHI audit: confirmed no PHI in push payloads, Sentry reports, or console logs
- [ ] Penetration test or security review completed
- [ ] App store data safety forms accurately completed
- [ ] Reviewer account with synthetic (non-real) test data prepared for app store submission
