# CareSync — Notification Flow Architecture

**Version:** 1.0  
**Date:** 2026-05-09

---

## Overview

The notification system is the most critical component of CareSync. A missed notification means a missed medication. The system is designed with redundancy (server-push + realtime fallback), delivery guarantees, and proper PHI protection.

---

## End-to-End Flow

### 1. Schedule Generation

```
Caregiver creates medication + schedule
    │
    ▼
medication_schedules row inserted (is_active = true)
    │
    ▼ (next cron run, within 5 minutes)
medication-scheduler Edge Function runs
    │
    ▼
Calculates next 24h of dose times from schedule
    │
    ▼
INSERT medication_events (status='pending', scheduled_time=X)
  UNIQUE constraint prevents duplicates
```

### 2. Reminder Delivery to Patient

```
medication-scheduler Edge Function (cron: every 5 min)
    │
    ├── For each event due within [now, now + 10min]:
    │
    ▼
Query push_tokens WHERE user_id = event.patient_id
    │
    ▼
For each token → POST to send-push Edge Function
    │
    ├── Android token → FCM HTTP v1 API
    │     Notification: { title: "Time for your medication",
    │                     body: "Open CareSync to confirm",
    │                     data: { event_id: "uuid" },
    │                     android: { priority: "high",
    │                                notification: { channel_id: "medications" } } }
    │
    └── iOS token → APNs HTTP/2
          Notification: { alert: { title: "Time for your medication",
                                   body: "Open CareSync to confirm" },
                          sound: "default",
                          badge: 1,
                          content-available: 1,
                          interruption-level: "time-sensitive",
                          custom: { event_id: "uuid" } }
```

**PHI Rule:** The `body` text is ALWAYS generic. The `event_id` is the only data payload. The app fetches medication details after the user opens the notification.

### 3. Patient Receives and Acts on Notification

```
Patient device receives push notification
    │
    ├── App is TERMINATED:
    │     System shows notification on lock screen
    │     Patient taps → iOS/Android launches app with notification data
    │     app/_layout.tsx: useLastNotificationResponse() detects event_id
    │     → router.push('/reminder/' + event_id)
    │     → app fetches event + medication from Supabase
    │     → Reminder screen shown
    │
    ├── App is BACKGROUND:
    │     System shows notification banner
    │     Patient taps → app is foregrounded with notification data
    │     Same deep-link handling as TERMINATED
    │
    └── App is FOREGROUND:
          In-app notification handler fires
          → Shows in-app alert/banner (React Native Paper Snackbar)
          → Auto-navigates to reminder screen after 2 seconds
          → OR immediately if patient is on another screen
```

### 4. Patient Confirms (Happy Path)

```
Patient taps "MEDICATION TAKEN"
    │
    ▼
Optimistic update: UI shows "Confirmed" immediately (no loading state)
    │
    ▼
supabase.from('medication_events')
  .update({ status: 'taken', taken_time: new Date().toISOString() })
  .eq('id', eventId)
  .eq('patient_id', userId)   ← RLS enforced but also explicit filter
    │
    ▼
PostgreSQL UPDATE succeeds
    │
    ▼
Supabase Realtime broadcasts the change
    │
    ▼
Caregiver app receives realtime event → adherence dashboard updates live
    │
    ▼
No alert is created (patient was compliant)
```

**Error handling for confirm:** If the network request fails, queue the update in AsyncStorage and retry with exponential backoff (up to 3 retries over 2 minutes). The optimistic UI stays "confirmed" to avoid confusing the patient.

### 5. Patient Snoozes

```
Patient taps "REMIND ME IN 30 MIN"
    │
    ▼
supabase.from('medication_events')
  .update({
    status: 'snoozed',
    snooze_count: current_snooze_count + 1
  })
  .eq('id', eventId)
    │
    ▼
Database Webhook fires → caregiver-alert Edge Function
    │
    ├── snooze_count < SNOOZE_LIMIT (3):
    │     No alert created
    │     medication-scheduler schedules a new event at (now + 30min)
    │     Patient receives another push notification in 30 minutes
    │
    └── snooze_count >= SNOOZE_LIMIT (3):
          Alert created for all active caregivers
          Push notification sent to all caregiver devices
          (see Section 7: Caregiver Alert Flow)
```

### 6. Patient Misses Medication (No Response)

```
medication-scheduler Edge Function (every 5 min)
    │
    ├── Check for overdue pending events:
    │   WHERE status = 'pending'
    │   AND scheduled_time + INTERVAL '30 minutes' < NOW()
    │
    ├── For each overdue event:
    │
    ▼
UPDATE medication_events SET status = 'missed'
    │
    ▼
Database Webhook fires → caregiver-alert Edge Function
    │
    ▼ (see Section 7)
```

**Grace period:** 30 minutes. The patient has 30 minutes after the scheduled time to confirm before the event is marked `missed`. This is configurable in `src/constants/config.ts` as `MISSED_GRACE_PERIOD_MINUTES`.

### 7. Caregiver Alert Flow

```
caregiver-alert Edge Function triggered (DB Webhook)
    │
    ▼
Query patient_caregiver_relationships
  WHERE patient_id = event.patient_id
  AND status = 'active'
    │
    ▼
For each active caregiver:
    │
    ├── INSERT alerts row:
    │     { patient_id, caregiver_id, event_id, alert_type, is_read: false }
    │
    └── Query push_tokens WHERE user_id = caregiver_id
          │
          ▼
        For each token → send-push Edge Function
          Android/iOS notification:
          { title: "Medication alert",
            body: "A patient may need your attention",
            data: { alert_id: "uuid", patient_id: "uuid" } }
          NOTE: No patient name, no medication name in payload (PHI protection)
```

### 8. Caregiver Receives Alert

```
Caregiver device receives push notification
    │
    ├── App is TERMINATED/BACKGROUND:
    │     Patient taps → deep-links to /(caregiver)/alerts
    │     Alert inbox shown with the new alert highlighted
    │
    └── App is FOREGROUND:
          Supabase Realtime subscription receives INSERT on alerts table
          → Badge count increments immediately
          → Optional: in-app banner shown
```

---

## Android-Specific Configuration

### Notification Channel

```typescript
// Set up on app startup (before any notifications fire)
await Notifications.setNotificationChannelAsync('medications', {
  name: 'Medication Reminders',
  importance: Notifications.AndroidImportance.MAX,  // IMPORTANCE_HIGH
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#1B6CA8',
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  bypassDnd: false,  // Respect Do Not Disturb (override with Critical if needed)
});

await Notifications.setNotificationChannelAsync('alerts', {
  name: 'Caregiver Alerts',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'default',
});
```

### Full-Screen Intent (Lock Screen Reminder)

The medication reminder requires `USE_FULL_SCREEN_INTENT` permission on Android 14+ and is set via the FCM payload:

```json
{
  "android": {
    "notification": {
      "channel_id": "medications",
      "notification_priority": "PRIORITY_MAX",
      "visibility": "PUBLIC"
    },
    "data": {
      "event_id": "uuid",
      "full_screen_intent": "true"
    }
  }
}
```

The app's `NotificationHandler` in `_layout.tsx` then opens the reminder screen in full-screen mode using `expo-router`'s modal presentation.

---

## iOS-Specific Configuration

### Entitlements Required

- `com.apple.developer.usernotifications.time-sensitive` — for Time-Sensitive interruptions (shows through Focus modes)
- Critical Alerts (`com.apple.developer.usernotifications.critical-alerts`) — bypasses Do Not Disturb entirely. **Requires explicit Apple approval.** Apply for this entitlement after launch.

For v1, we use Time-Sensitive interruptions (no Apple approval needed).

### APNs Payload

```json
{
  "aps": {
    "alert": {
      "title": "Time for your medication",
      "body": "Open CareSync to confirm"
    },
    "sound": "default",
    "badge": 1,
    "content-available": 1,
    "interruption-level": "time-sensitive"
  },
  "event_id": "uuid"
}
```

---

## Token Management

### Registration Flow

```typescript
// On app startup (after auth, in _layout.tsx):
1. Check existing token in push_tokens table for this device
2. Request notification permission (first time shows system dialog)
3. Get current FCM/APNs token via Notifications.getExpoPushTokenAsync()
   OR Notifications.getDevicePushTokenAsync() (for raw FCM/APNs)
4. If token changed (app reinstall or token rotation):
   UPSERT push_tokens WHERE user_id = userId AND token = newToken
5. Store token in AsyncStorage for comparison on next launch
```

### Token Cleanup

Stale tokens (invalid after app uninstall) are cleaned up when FCM/APNs returns a delivery error. The `send-push` Edge Function must handle `410 Gone` responses by deleting the token from `push_tokens`.

---

## Delivery Reliability

| Scenario | Handling |
|---|---|
| Patient phone is off | FCM/APNs holds for up to 28 days (TTL) |
| Patient has no internet | Notification delivered when reconnected (within TTL) |
| Patient dismissed notification | Supabase Realtime delivers the new pending event to the app when it opens |
| Scheduler function fails | Cron retries in 5 minutes; idempotent design prevents duplicates |
| Push service down | Event still exists in DB; patient will see reminder when they open the app |
| Multiple devices for one user | Push sent to all registered tokens; only first confirmation counts |

---

## Constants

```typescript
// src/constants/config.ts
export const SNOOZE_LIMIT = 3;                    // Alerts caregiver after 3rd snooze
export const MISSED_GRACE_PERIOD_MINUTES = 30;     // Mark missed after 30 min
export const SNOOZE_DURATION_MINUTES = 30;         // Default snooze duration
export const SNOOZE_OPTIONS_MINUTES = [15, 30, 60]; // Options shown to patient
export const SCHEDULER_LOOKAHEAD_HOURS = 24;       // Generate events 24h in advance
export const PUSH_TOKEN_TTL_DAYS = 30;             // Clean up tokens older than 30d
```
