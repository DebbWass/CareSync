# CareSync — API Reference

**Version:** 1.0  
**Date:** 2026-05-09

---

## Overview

CareSync does not expose a traditional REST API. The mobile app communicates with Supabase directly using the Supabase JS client (auto-generated REST + WebSocket). Backend logic is handled by three Supabase Edge Functions.

---

## Edge Functions

All Edge Functions are deployed to Supabase and run on Deno. They use the `service_role` key (server-side only) to bypass RLS when needed.

Base URL: `https://{PROJECT_REF}.supabase.co/functions/v1/`

---

### POST /medication-scheduler

**Purpose:** Generates upcoming medication_events and sends push reminders. Called by Supabase cron (not the mobile app directly).

**Auth:** Supabase service_role key (internal only)  
**Trigger:** Cron — every 5 minutes

**Logic:**
1. Query all active medication_schedules
2. Calculate dose times for the next 24 hours
3. INSERT medication_events for any times not already in the table
4. Mark overdue pending events as `missed`
5. Send push notifications for events due within the next 10 minutes

**Response:**
```json
{ "processed": 12, "new_events": 3, "notifications_sent": 3, "marked_missed": 1 }
```

---

### POST /send-push

**Purpose:** Centralized push notification delivery. Called by other Edge Functions.

**Auth:** Supabase service_role key (internal only)

**Request Body:**
```typescript
{
  user_id: string;          // UUID of the recipient
  title: string;            // Notification title (no PHI)
  body: string;             // Notification body (no PHI)
  data: {
    type: 'reminder' | 'alert';
    event_id?: string;      // For reminders: the medication_event UUID
    alert_id?: string;      // For alerts: the alert UUID
    patient_id?: string;    // For alerts: the patient UUID (for routing)
  };
  channel?: string;         // Android channel: 'medications' | 'alerts' (default: 'medications')
}
```

**Response:**
```json
{
  "sent": 2,
  "failed": 0,
  "tokens": [
    { "token": "...", "platform": "android", "status": "sent" },
    { "token": "...", "platform": "ios", "status": "sent" }
  ]
}
```

**Error handling:**
- `410 Gone` from FCM/APNs: token is deleted from `push_tokens` automatically
- `400 BadDeviceToken` from APNs: token deleted
- Other failures: logged, not retried (scheduler will retry on next cron run)

---

### POST /caregiver-alert

**Purpose:** Creates caregiver alert rows and sends push notifications to all caregivers of a patient. Triggered by a Supabase Database Webhook.

**Auth:** Supabase service_role key (internal only)  
**Trigger:** Supabase Database Webhook — on `medication_events` UPDATE  
**Condition fires when:** `status` = `'missed'` OR `snooze_count` >= `SNOOZE_LIMIT`

**Request Body (from Supabase Webhook):**
```json
{
  "type": "UPDATE",
  "table": "medication_events",
  "record": {
    "id": "uuid",
    "patient_id": "uuid",
    "medication_id": "uuid",
    "status": "missed",
    "snooze_count": 0,
    "scheduled_time": "2026-05-09T08:00:00Z"
  },
  "old_record": {
    "status": "pending",
    "snooze_count": 0
  }
}
```

**Logic:**
1. Validate: is this a relevant status change? (not already alerted)
2. Determine alert_type: `'missed'` or `'snoozed_limit'`
3. Query active caregivers for `patient_id`
4. For each caregiver: INSERT `alerts` row + call `send-push`

**Response:**
```json
{ "alerts_created": 2, "notifications_sent": 2 }
```

---

## Supabase Client — Key Operations

These are the primary database operations in the mobile app, using the Supabase JS SDK. All are subject to RLS — the client uses the `anon` key.

### Authentication

```typescript
// Register
supabase.auth.signUp({
  email, password,
  options: { data: { name, role } }  // Passed to handle_new_user() trigger
})

// Login
supabase.auth.signInWithPassword({ email, password })

// Logout
supabase.auth.signOut()

// Get current session
supabase.auth.getSession()

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => { ... })
```

### Medication Events — Patient Actions

```typescript
// Confirm medication taken
supabase
  .from('medication_events')
  .update({
    status: 'taken',
    taken_time: new Date().toISOString()
  })
  .eq('id', eventId)
  .eq('patient_id', userId)  // Belt-and-suspenders (RLS also enforces this)

// Snooze medication
supabase
  .from('medication_events')
  .update({
    status: 'snoozed',
    snooze_count: currentSnoozeCount + 1
  })
  .eq('id', eventId)
```

### Medication Events — Caregiver Queries

```typescript
// Get today's events for a patient (adherence dashboard)
supabase
  .from('medication_events')
  .select(`
    id, scheduled_time, taken_time, status, snooze_count,
    medications ( name, dosage )
  `)
  .eq('patient_id', patientId)
  .gte('scheduled_time', startOfDay.toISOString())
  .lte('scheduled_time', endOfDay.toISOString())
  .order('scheduled_time', { ascending: true })

// Get history (last 30 days)
supabase
  .from('medication_events')
  .select('id, scheduled_time, taken_time, status, medications ( name )')
  .eq('patient_id', patientId)
  .gte('scheduled_time', thirtyDaysAgo.toISOString())
  .order('scheduled_time', { ascending: false })
```

### Medications — Caregiver Management

```typescript
// Get active medications for a patient
supabase
  .from('medications')
  .select('*, medication_schedules(*)')
  .eq('patient_id', patientId)
  .eq('is_active', true)

// Add medication
supabase
  .from('medications')
  .insert({ patient_id, created_by: userId, name, dosage, instructions })

// Deactivate medication (soft delete)
supabase
  .from('medications')
  .update({ is_active: false })
  .eq('id', medicationId)
```

### Alerts — Caregiver Inbox

```typescript
// Get unread alerts
supabase
  .from('alerts')
  .select('*, medication_events ( scheduled_time, status ), users!patient_id ( name )')
  .eq('caregiver_id', userId)
  .eq('is_read', false)
  .order('created_at', { ascending: false })

// Mark alert as read
supabase
  .from('alerts')
  .update({ is_read: true })
  .eq('id', alertId)
```

### Push Token Registration

```typescript
// Upsert push token (on app start)
supabase
  .from('push_tokens')
  .upsert(
    { user_id: userId, token, platform },
    { onConflict: 'user_id,token' }
  )
```

### Realtime Subscriptions

```typescript
// Patient: listen for new medication events
supabase
  .channel('patient-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'medication_events',
    filter: `patient_id=eq.${userId}`
  }, (payload) => { /* handle new reminder */ })
  .subscribe()

// Caregiver: listen for new alerts
supabase
  .channel('caregiver-alerts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'alerts',
    filter: `caregiver_id=eq.${userId}`
  }, (payload) => { /* increment badge, show banner */ })
  .subscribe()
```

---

## Error Codes

| Code | Meaning | Handling |
|---|---|---|
| `PGRST116` | Row not found | Show "not found" UI state |
| `42501` | RLS policy violation | Log out user (session may be invalid) |
| `23505` | Unique constraint violation | Idempotent — event already exists, ignore |
| `23503` | Foreign key violation | Data integrity issue — log to Sentry |
| Network timeout | Supabase unreachable | Show offline banner, queue retry |
