import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMedication,
  deactivateMedication,
  getMedication,
  getMedications,
  type CreateMedicationInput,
  type UpdateMedicationInput,
  updateMedication,
} from '../services/supabase/medications';
import { useAuthStore } from '../store/authStore';

// ── Query keys ────────────────────────────────────────────────────────────────

export const medicationKeys = {
  list: (patientId: string) => ['medications', 'list', patientId] as const,
  detail: (id: string) => ['medications', 'detail', id] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Lists active medications for the given patient. */
export function useMedications(patientId: string | undefined) {
  return useQuery({
    queryKey: medicationKeys.list(patientId ?? ''),
    queryFn: () => (patientId ? getMedications(patientId) : []),
    enabled: !!patientId,
  });
}

/** Fetches a single medication for the edit screen. */
export function useMedication(id: string | undefined) {
  return useQuery({
    queryKey: medicationKeys.detail(id ?? ''),
    queryFn: () => (id ? getMedication(id) : null),
    enabled: !!id,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateMedication() {
  const qc = useQueryClient();
  const caregiverId = useAuthStore((s) => s.profile?.id ?? '');
  return useMutation({
    mutationFn: (input: CreateMedicationInput) =>
      createMedication(input, caregiverId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: medicationKeys.list(variables.patient_id) });
    },
  });
}

export function useUpdateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMedicationInput }) =>
      updateMedication(id, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: medicationKeys.list(patientId) });
      qc.invalidateQueries({ queryKey: medicationKeys.detail(variables.id) });
    },
  });
}

export function useDeactivateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateMedication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationKeys.list(patientId) });
    },
  });
}
