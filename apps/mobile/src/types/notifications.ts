// Push notification payload types — PHI must NEVER appear in these payloads

export type NotificationType = 'reminder' | 'alert';

export interface ReminderNotificationData {
  type: 'reminder';
  event_id: string;  // UUID — app fetches details from Supabase after tap
}

export interface AlertNotificationData {
  type: 'alert';
  alert_id: string;   // UUID
  patient_id: string; // For routing to the correct patient's data
}

export type NotificationData = ReminderNotificationData | AlertNotificationData;
