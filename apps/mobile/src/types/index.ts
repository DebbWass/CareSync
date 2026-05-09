// Domain types for CareSync — mirrors the database schema

export type UserRole = 'patient' | 'caregiver';
export type RelationshipStatus = 'pending' | 'active' | 'revoked';
export type FrequencyType = 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'custom';
export type EventStatus = 'pending' | 'taken' | 'snoozed' | 'missed';
export type AlertType = 'missed' | 'snoozed_limit' | 'low_adherence' | 'new_medication';
export type PushPlatform = 'ios' | 'android';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

export interface PatientCaregiverRelationship {
  id: string;
  patient_id: string;
  caregiver_id: string;
  status: RelationshipStatus;
  created_at: string;
  // Joined data
  patient?: User;
  caregiver?: User;
}

export interface Medication {
  id: string;
  patient_id: string;
  created_by: string;
  name: string;
  dosage: string;
  instructions?: string;
  is_active: boolean;
  created_at: string;
  // Joined data
  medication_schedules?: MedicationSchedule[];
}

export interface MedicationSchedule {
  id: string;
  medication_id: string;
  frequency_type: FrequencyType;
  times_of_day: string[];     // ["08:00", "20:00"]
  days_of_week?: number[];    // [0=Sun, 1=Mon, ..., 6=Sat]; null = every day
  start_date: string;         // ISO date string "YYYY-MM-DD"
  end_date?: string;
  is_active: boolean;
  created_at: string;
}

export interface MedicationEvent {
  id: string;
  schedule_id: string;
  medication_id: string;
  patient_id: string;
  scheduled_time: string;     // ISO timestamp
  taken_time?: string;        // ISO timestamp; undefined until confirmed
  status: EventStatus;
  snooze_count: number;
  notes?: string;
  created_at: string;
  // Joined data
  medications?: Pick<Medication, 'name' | 'dosage' | 'instructions'>;
}

export interface Alert {
  id: string;
  patient_id: string;
  caregiver_id: string;
  event_id?: string;
  alert_type: AlertType;
  is_read: boolean;
  created_at: string;
  // Joined data
  medication_events?: Pick<MedicationEvent, 'scheduled_time' | 'status'>;
  patient?: Pick<User, 'name'>;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: PushPlatform;
  created_at: string;
}

// Adherence stats (computed client-side or via query)
export interface AdherenceStats {
  total: number;
  taken: number;
  missed: number;
  snoozed: number;
  pending: number;
  adherenceRate: number;  // 0–100
}
