import { useQuery } from '@tanstack/react-query';
import {
  getLinkedPatients,
  getPatientInvitations,
  getPendingInvitations,
} from '../services/supabase/patients';
import { useAuthStore } from '../store/authStore';

export const patientKeys = {
  linked: (caregiverId: string) => ['patients', 'linked', caregiverId] as const,
  pending: (caregiverId: string) => ['patients', 'pending', caregiverId] as const,
  invitations: (patientId: string) => ['patients', 'invitations', patientId] as const,
};

/** Returns all active patients linked to the current caregiver. */
export function useLinkedPatients() {
  const caregiverId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: patientKeys.linked(caregiverId ?? ''),
    queryFn: () => (caregiverId ? getLinkedPatients(caregiverId) : []),
    enabled: !!caregiverId,
  });
}

/** Returns pending invitations sent by the current caregiver. */
export function usePendingInvitations() {
  const caregiverId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: patientKeys.pending(caregiverId ?? ''),
    queryFn: () => (caregiverId ? getPendingInvitations(caregiverId) : []),
    enabled: !!caregiverId,
  });
}

/**
 * Returns pending invitations addressed to the current patient (caregiver
 * name/email included). Polls so a freshly-sent invite appears without a
 * manual refresh.
 */
export function usePatientInvitations() {
  const patientId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: patientKeys.invitations(patientId ?? ''),
    queryFn: () => getPatientInvitations(),
    enabled: !!patientId,
    refetchInterval: 60_000,
  });
}
