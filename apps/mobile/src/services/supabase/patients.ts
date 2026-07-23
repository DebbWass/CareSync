import { supabase } from '../../lib/supabase';
import { AppError, normalizeSupabaseError } from './errors';
import type { PatientCaregiverRelationship, User } from '../../types';

/** A pending invitation as seen by the patient (from get_patient_invitations). */
export interface PatientInvitation {
  relationship_id: string;
  caregiver_id: string;
  caregiver_name: string;
  caregiver_email: string;
  created_at: string;
}

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
 *
 * The lookup goes through the `find_patient_id_by_email` SECURITY DEFINER RPC,
 * NOT a direct SELECT: users_select RLS only exposes patients the caregiver is
 * ALREADY linked to, so a direct query for a not-yet-linked patient always
 * returns zero rows and wrongly reports "no patient found". The RPC resolves the
 * id (role='patient' only); the relationship INSERT below still runs under RLS.
 */
export async function invitePatientByEmail(
  caregiverId: string,
  patientEmail: string
): Promise<void> {
  const { data: patientId, error: lookupError } = await supabase.rpc('find_patient_id_by_email', {
    p_email: patientEmail.toLowerCase().trim(),
  });

  if (lookupError) throw normalizeSupabaseError(lookupError);
  if (!patientId) {
    // Screens render this as a contextual "no patient with that email" message
    throw new AppError('notFound');
  }

  const { error } = await supabase
    .from('patient_caregiver_relationships')
    .insert({ patient_id: patientId, caregiver_id: caregiverId });

  if (!error) return; // fresh invitation created

  // A row already exists for this pair (UNIQUE constraint, 23505). It may be a
  // previously CANCELLED/REVOKED link — re-inviting should revive it. Reset it
  // to 'pending' unless it is already 'active' (then it's a genuine "already
  // linked" conflict). RLS lets the caregiver update their own relationship.
  if (normalizeSupabaseError(error).code !== 'conflict') throw normalizeSupabaseError(error);

  const { data: revived, error: reviveError } = await supabase
    .from('patient_caregiver_relationships')
    .update({ status: 'pending' })
    .eq('patient_id', patientId)
    .eq('caregiver_id', caregiverId)
    .neq('status', 'active')
    .select('id');

  if (reviveError) throw normalizeSupabaseError(reviveError);
  if (!revived || revived.length === 0) throw new AppError('conflict'); // already active
}

/**
 * Pending invitations addressed to the current patient, with the inviting
 * caregiver's name/email. Uses the get_patient_invitations RPC because
 * users_select RLS hides the caregiver profile until the link is active.
 */
export async function getPatientInvitations(): Promise<PatientInvitation[]> {
  const { data, error } = await supabase.rpc('get_patient_invitations');
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as PatientInvitation[];
}

/**
 * Patient responds to an invitation: accept → 'active', decline → 'revoked'.
 * RLS (relationships_update) authorizes the patient to update their own row.
 */
export async function respondToInvitation(relationshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('patient_caregiver_relationships')
    .update({ status: accept ? 'active' : 'revoked' })
    .eq('id', relationshipId);

  if (error) throw normalizeSupabaseError(error);
}

/**
 * Caregiver cancels a still-pending invitation they sent (status → 'revoked').
 * Same operation as revokeAccess; named for the pending-invite UI context.
 */
export async function cancelInvitation(relationshipId: string): Promise<void> {
  return revokeAccess(relationshipId);
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
