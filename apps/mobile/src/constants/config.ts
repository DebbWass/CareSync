// CareSync application constants
// Changing these values affects medication alert thresholds system-wide

// Number of snoozes before caregiver is alerted
export const SNOOZE_LIMIT = 3;

// Minutes after scheduled_time before an unanswered event is marked 'missed'
export const MISSED_GRACE_PERIOD_MINUTES = 30;

// Default snooze duration in minutes
export const SNOOZE_DURATION_DEFAULT_MINUTES = 30;

// Options shown to the patient when they tap Snooze
export const SNOOZE_OPTIONS_MINUTES = [15, 30, 60] as const;

// How far ahead the scheduler generates medication_events (hours)
export const SCHEDULER_LOOKAHEAD_HOURS = 24;

// How long to wait before retry on failed confirmation (ms)
export const CONFIRM_RETRY_DELAY_MS = 5000;

// Maximum retries for a failed medication event update
export const CONFIRM_MAX_RETRIES = 3;

// Notification channel IDs (must match app.json + Android setup)
export const NOTIFICATION_CHANNELS = {
  medications: 'medications',
  alerts: 'alerts',
} as const;

// How many days of history to load by default
export const HISTORY_DEFAULT_DAYS = 30;

// Minimum touch target size in dp (WCAG 2.1 AA)
export const MIN_TOUCH_TARGET_DP = 48;

// Patient app primary button minimum height in dp
export const PATIENT_PRIMARY_BUTTON_HEIGHT_DP = 80;
