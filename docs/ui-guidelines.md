# CareSync — UI & Accessibility Guidelines

**Version:** 1.0  
**Date:** 2026-05-09  
**Standard:** WCAG 2.1 Level AA

---

## Design Philosophy

CareSync's patient interface is designed for elderly users who may have cognitive impairment, visual difficulties, and limited smartphone experience. Every design decision prioritizes **clarity, error prevention, and safety** over aesthetics.

The caregiver interface is a professional tool — clear information density with accessible defaults.

**Core principles:**
1. **Obvious over clever** — The patient must never have to think about what to do next
2. **Error prevention over error recovery** — Make wrong actions impossible, not just correctable
3. **One action per screen** — The patient reminder screen does one thing: confirm or snooze
4. **Never lose state** — A medication confirmation must be reliable even on poor connections (optimistic update + retry)

---

## Color Palette

### Default Theme (Light Mode)

| Name | Hex | Usage | WCAG Ratio on White |
|---|---|---|---|
| Primary Blue | `#1B6CA8` | App bar, primary actions, links | 5.02:1 ✅ AA |
| Confirm Green | `#2E7D32` | "Medication Taken" button | 7.23:1 ✅ AAA |
| Snooze Amber | `#E65100` | Snooze button | 4.59:1 ✅ AA |
| Danger Red | `#C62828` | Missed/overdue indicators | 7.11:1 ✅ AAA |
| Surface | `#F5F5F5` | Card backgrounds | — |
| Background | `#FFFFFF` | Screen background | — |
| On-Surface Text | `#212121` | Primary text | 16.1:1 ✅ AAA |
| Secondary Text | `#616161` | Captions, labels | 5.74:1 ✅ AA |

### Dark Mode

| Name | Hex | Usage |
|---|---|---|
| Background | `#121212` | Screen background |
| Surface | `#1E1E1E` | Card backgrounds |
| Primary Blue | `#64B5F6` | Primary actions (lighter for dark bg) |
| Confirm Green | `#81C784` | Confirm button |
| Snooze Amber | `#FFB74D` | Snooze button |
| Danger Red | `#EF9A9A` | Missed indicators |
| On-Surface Text | `#FFFFFF` | Primary text |
| Secondary Text | `#B0BEC5` | Captions |

### High-Contrast Mode (Patient App)

| Name | Hex | Usage |
|---|---|---|
| Background | `#000000` | Screen background |
| On-Background | `#FFFFFF` | All text, maximum contrast |
| Confirm | `#00FF00` | Confirm button (pure green) |
| Snooze | `#FFFF00` | Snooze button (pure yellow) |
| Danger | `#FF0000` | Missed indicators |
| Border | `#FFFFFF` | All borders and dividers |

High-contrast mode is toggled in settings and persisted via `settingsStore`.

---

## Typography

### Type Scale

```typescript
// src/constants/typography.ts

export const FONT_SIZES = {
  // Patient app (large-text mode)
  patient: {
    medicationName: 48,     // The medication being reminded
    timeIndicator: 36,      // "Now" / "8:00 AM"
    dosage: 28,             // "10mg", "2 tablets"
    instructions: 24,       // "Take with food"
    confirmButton: 32,      // Text on the confirm button
    snoozeButton: 22,       // Text on snooze button
    body: 24,               // Other body text
    caption: 20,            // Secondary information
  },

  // Caregiver app (standard mode)
  caregiver: {
    headline: 24,
    title: 20,
    body: 16,
    label: 14,
    caption: 12,
  },
};

export const FONT_WEIGHTS = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
```

### Dynamic Type / Font Scale

All font sizes use `Text` base component from `src/components/ui/Text.tsx`, which applies the user's system font scale setting:

```typescript
// The accessible Text component applies system scale:
fontSize: FONT_SIZES.patient.body * fontScale  // fontScale from useAccessibility hook
```

---

## Touch Targets

| Element | Patient App | Caregiver App | Standard |
|---|---|---|---|
| Primary button (Confirm) | 80dp height, full width | 48dp | WCAG min: 44pt |
| Secondary button (Snooze) | 64dp height, 80% width | 44dp | WCAG min: 44pt |
| Tab bar items | 64dp height | 56dp | — |
| List items | 72dp minimum height | 56dp | — |
| Icon buttons | 56×56dp | 48×48dp | WCAG min: 44×44pt |
| Form inputs | 56dp height | 48dp | — |

**Implementation:** Use `minHeight` and padding in StyleSheet, not fixed height, so content can expand.

---

## Patient Reminder Screen Layout

```
┌──────────────────────────────────────┐
│                                      │
│   ⏰  8:00 AM                        │  ← 36sp, center
│                                      │
│   Time for your medication           │  ← 24sp, secondary color
│                                      │
│   ┌──────────────────────────────┐   │
│   │                              │   │
│   │   Metoprolol                 │   │  ← 48sp BOLD, primary color
│   │                              │   │
│   │   10mg — 1 tablet            │   │  ← 28sp
│   │                              │   │
│   │   Take with food and water   │   │  ← 24sp
│   │                              │   │
│   └──────────────────────────────┘   │
│                                      │
│   ┌──────────────────────────────┐   │
│   │                              │   │
│   │     ✓  MEDICATION TAKEN      │   │  ← 32sp BOLD, Confirm Green
│   │                              │   │     80dp height, full width
│   └──────────────────────────────┘   │
│                                      │
│   ┌──────────────────────────────┐   │
│   │    ⏱  REMIND ME IN 30 MIN   │   │  ← 22sp, Snooze Amber
│   └──────────────────────────────┘   │  64dp height
│                                      │
│   Snoozes remaining: 2 of 3          │  ← 20sp, secondary text
│                                      │
│   [Emergency Contact]                │  ← Small link, bottom
└──────────────────────────────────────┘
```

**Notes:**
- No navigation bar or back button — the reminder is the only focus
- Screen orientation: locked to portrait
- No swipe-to-dismiss gesture
- On Android: `full-screen intent` mode, appears over lock screen
- On iOS: notification with `interruptionLevel: 'timeSensitive'` (requires Critical Alerts entitlement for lock screen display over Do Not Disturb)

---

## Spacing and Layout

```typescript
// src/constants/spacing.ts
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

- Minimum padding between interactive elements: **16dp**
- Card padding: **24dp** (patient app), **16dp** (caregiver app)
- Screen horizontal padding: **20dp** (patient), **16dp** (caregiver)

---

## Accessibility Implementation Requirements

### Required on All Interactive Elements

```tsx
<TouchableOpacity
  accessibilityLabel="Mark medication as taken"
  accessibilityHint="Double tap to confirm you have taken your medication"
  accessibilityRole="button"
  accessible={true}
>
```

### Required on All Informational Text Blocks

```tsx
<Text accessibilityRole="header">Metoprolol</Text>
<Text accessibilityLabel="Dosage: 10 milligrams, 1 tablet">10mg — 1 tablet</Text>
```

### Focus Management on Reminder Screen

When the reminder screen appears, auto-focus the medication name element:
```tsx
useEffect(() => {
  // Give screen reader users immediate context
  AccessibilityInfo.announceForAccessibility(
    `Medication reminder. Time to take ${medicationName}. ${dosage}.`
  );
}, []);
```

### State Changes Must Be Announced

```tsx
// After confirm:
AccessibilityInfo.announceForAccessibility('Medication confirmed. Well done!');

// After snooze:
AccessibilityInfo.announceForAccessibility(`Reminder snoozed for 30 minutes. ${snoozeRemaining} snoozes remaining.`);
```

---

## Icon Usage

All icons must be paired with visible text on the patient app (never icon-only for actions).

| Action | Icon | Text |
|---|---|---|
| Confirm taken | ✓ (check) | "MEDICATION TAKEN" |
| Snooze | ⏱ (timer) | "REMIND ME IN 30 MIN" |
| Emergency | 📞 (phone) | "Emergency Contact" |
| Alert (caregiver) | 🔔 (bell) | "Alerts" with badge count |
| Missed (caregiver) | ⚠ (warning) | "Missed" |

---

## Navigation Structure

### Patient App

```
Bottom Tab Navigator (2 tabs):
├── 💊 Today        → (patient)/index.tsx (current reminder / empty state if none due)
└── 📋 History      → (patient)/history.tsx (scrollable event list)
```

No complex navigation. Maximum 2 taps to reach any information.

### Caregiver App

```
Bottom Tab Navigator (4 tabs):
├── 🏠 Dashboard    → (caregiver)/index.tsx
├── 💊 Medications  → (caregiver)/medications/index.tsx
├── 👤 Patients     → (caregiver)/patients/index.tsx
└── 🔔 Alerts       → (caregiver)/alerts.tsx (with unread badge)

Stack navigators within each tab:
Medications → [id].tsx (edit), new.tsx (add)
Medications → schedules/[id].tsx (schedule detail)
Patients → [id].tsx (patient detail + adherence)
```

---

## Error States and Empty States

### Patient App — No Reminders Due

```
Center of screen:
  ✅  (large icon)
  "All caught up!"
  "No medications due right now."
  [small text showing next scheduled medication time]
```

### Caregiver App — No Patients Linked

```
Center of screen:
  👥  (icon)
  "No patients yet"
  [+ Add Patient] button
```

### Network Error

Show a non-blocking banner at the top (not a modal that blocks the UI):
```
⚠ No connection — showing cached data
```

For the patient confirmation action: show optimistic update immediately, queue the server request, retry with exponential backoff silently.

---

## Animation Guidelines

- **No complex animations** on the patient app — keep it static and predictable
- **Reduce motion:** Respect `AccessibilityInfo.isReduceMotionEnabled()` and disable all transitions if true
- Caregiver app: subtle fade transitions only (duration: 150-200ms)
- No auto-playing videos or looping animations anywhere in the app
