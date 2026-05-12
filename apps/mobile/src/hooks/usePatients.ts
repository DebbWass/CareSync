import { useQuery } from '@tanstack/react-query';
import { getLinkedPatients, getPendingInvitations } from '../services/supabase/patients';
import { useAuthStore } from '../store/authStore';

export const patientKeys = {
  linked: (caregiverId: string) => ['patients', 'linked', caregiverId] as const,
  pending: (caregiverId: string) => ['patients', 'pending', caregiverId] as const,
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
