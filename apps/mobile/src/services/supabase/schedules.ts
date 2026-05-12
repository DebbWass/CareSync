import { supabase } from '../../lib/supabase';
import type { FrequencyType, MedicationSchedule } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleWithMedication extends MedicationSchedule {
  medications?: { name: string; dosage: string; patient_id: string };
}

export interface CreateScheduleInput {
  medication_id: string;
  frequency_type: FrequencyType;
  times_of_day: string[];       // ["08:00", "20:00"]
  days_of_week?: number[];      // [0..6]; undefined = every day
  start_date: string;           // "YYYY-MM-DD"
  end_date?: string;
}

export interface UpdateScheduleInput {
  frequency_type?: FrequencyType;
  times_of_day?: string[];
  days_of_week?: number[] | null;
  start_date?: string;
  end_date?: string | null;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All active schedules for a specific medication. */
export async function getSchedulesForMedication(
  medicationId: string
): Promise<MedicationSchedule[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('medication_id', medicationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[Schedules] getSchedulesForMedication error:', error.message);
    return [];
  }
  return (data ?? []) as MedicationSchedule[];
}

/** All active schedules for a patient, joined with medication name/dosage. */
export async function getSchedulesForPatient(
  patientId: string
): Promise<ScheduleWithMedication[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*, medications!inner(name, dosage, patient_id)')
    .eq('medications.patient_id', patientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Schedules] getSchedulesForPatient error:', error.message);
    return [];
  }
  return (data ?? []) as ScheduleWithMedication[];
}

/** Single schedule by ID. */
export async function getSchedule(id: string): Promise<MedicationSchedule | null> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.warn('[Schedules] getSchedule error:', error.message);
    return null;
  }
  return data as MedicationSchedule;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createSchedule(
  input: CreateScheduleInput
): Promise<MedicationSchedule> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as MedicationSchedule;
}

export async function updateSchedule(
  id: string,
  input: UpdateScheduleInput
): Promise<void> {
  const { error } = await supabase
    .from('medication_schedules')
    .update(input)
    .eq('id', id);

  if (error) throw error;
}

export async function deactivateSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('medication_schedules')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}
