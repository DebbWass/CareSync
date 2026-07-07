import { supabase } from '../../lib/supabase';
import { AppError, normalizeSupabaseError } from './errors';
import type { PatientCaregiverRelationship, User } from '../../types';

/**
 * Get all patients linked to this caregiver (status = 'active').
 * Returns full patient profile with the relationship record.
 */
export async function getLinkedPatients(
  caregiverId: string
): Promise<(PatientCaregiverRelationship & { patient: User })[]> {
  const { data, error } = await supabase
    .from('patient_caregiver_relationships')
    .select('*, patient:users!patient_id(*)')
    .eq('caregiver_id', caregiverId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as (PatientCaregiverRelationship & { patient: User })[];
}

/**
 * Get all pending invitations sent by this caregiver (awaiting patient acceptance).
 */
export async function getPendingInvitations(
  caregiverId: string
): Promise<PatientCaregiverRelationship[]> {
  const { data, error } = await supabase
    .from('patient_caregiver_relationships')
    .select('*, patient:users!patient_id(id, name, email)')
    .eq('caregiver_id', caregiverId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as PatientCaregiverRelationship[];
}

/**
 * Send an invitation to a patient by their email address.
 * The DB trigger will look up the user by email.
 */
export async function invitePatientByEmail(
  caregiverId: string,
  patientEmail: string
): Promise<void> {
  // Look up the patient user by email
  const { data: patientUser, error: lookupError } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', patientEmail.toLowerCase().trim())
    .eq('role', 'patient')
    .single();

  if (lookupError || !patientUser) {
    // Screens render this as a contextual "no patient with that email" message
    throw new AppError('notFound', lookupError);
  }

  const { error } = await supabase
    .from('patient_caregiver_relationships')
    .insert({ patient_id: patientUser.id, caregiver_id: caregiverId });

  // 23505 (already invited) normalizes to 'conflict'
  if (error) throw normalizeSupabaseError(error);
}

/**
 * Revoke the caregiver's access to a patient.
 */
export async function revokeAccess(relationshipId: string): Promise<void> {
  const { error } = await supabase
    .from('patient_caregiver_relationships')
    .update({ status: 'revoked' })
    .eq('id', relationshipId);

  if (error) throw normalizeSupabaseError(error);
}
