import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSchedule,
  deactivateSchedule,
  getSchedule,
  getSchedulesForMedication,
  getSchedulesForPatient,
  updateSchedule,
  type CreateScheduleInput,
  type UpdateScheduleInput,
} from '../services/supabase/schedules';

export const scheduleKeys = {
  byMedication: (medicationId: string) =>
    ['schedules', 'medication', medicationId] as const,
  byPatient: (patientId: string) =>
    ['schedules', 'patient', patientId] as const,
  detail: (id: string) => ['schedules', 'detail', id] as const,
};

export function useSchedulesForMedication(medicationId: string | undefined) {
  return useQuery({
    queryKey: scheduleKeys.byMedication(medicationId ?? ''),
    queryFn: () =>
      medicationId ? getSchedulesForMedication(medicationId) : [],
    enabled: !!medicationId,
  });
}

export function useSchedulesForPatient(patientId: string | undefined) {
  return useQuery({
    queryKey: scheduleKeys.byPatient(patientId ?? ''),
    queryFn: () => (patientId ? getSchedulesForPatient(patientId) : []),
    enabled: !!patientId,
  });
}

export function useSchedule(id: string | undefined) {
  return useQuery({
    queryKey: scheduleKeys.detail(id ?? ''),
    queryFn: () => (id ? getSchedule(id) : null),
    enabled: !!id,
  });
}

export function useCreateSchedule(medicationId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScheduleInput) => createSchedule(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleKeys.byMedication(medicationId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.byPatient(patientId) });
    },
  });
}

export function useUpdateSchedule(medicationId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScheduleInput }) =>
      updateSchedule(id, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: scheduleKeys.byMedication(medicationId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.byPatient(patientId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.detail(variables.id) });
    },
  });
}

export function useDeactivateSchedule(medicationId: string, patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSchedule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleKeys.byMedication(medicationId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.byPatient(patientId) });
    },
  });
}
