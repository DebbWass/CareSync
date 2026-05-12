import { supabase } from '../../lib/supabase';
import type { Medication } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateMedicationInput {
  patient_id: string;
  name: string;
  dosage: string;
  instructions?: string;
}

export interface UpdateMedicationInput {
  name?: string;
  dosage?: string;
  instructions?: string;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Get all active medications for a patient, ordered by name. */
export async function getMedications(patientId: string): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.warn('[Medications] getMedications error:', error.message);
    return [];
  }
  return (data ?? []) as Medication[];
}

/** Get a single medication by ID (including inactive ones, for edit view). */
export async function getMedication(id: string): Promise<Medication | null> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.warn('[Medications] getMedication error:', error.message);
    return null;
  }
  return data as Medication;
}

/** Get the count of active medications for a patient (for dashboard badge). */
export async function getMedicationCount(patientId: string): Promise<number> {
  const { count, error } = await supabase
    .from('medications')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('is_active', true);

  if (error) return 0;
  return count ?? 0;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Create a new medication. Caregiver's ID is set via RLS context. */
export async function createMedication(
  input: CreateMedicationInput,
  createdBy: string
): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .insert({ ...input, created_by: createdBy })
    .select()
    .single();

  if (error) throw error;
  return data as Medication;
}

/** Update a medication's name, dosage, or instructions. */
export async function updateMedication(
  id: string,
  input: UpdateMedicationInput
): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update(input)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Soft-delete a medication by setting is_active = false.
 * Historical medication_events referencing this medication are preserved.
 */
export async function deactivateMedication(id: string): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}
