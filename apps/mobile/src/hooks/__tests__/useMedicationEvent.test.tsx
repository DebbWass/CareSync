/**
 * Tests for the optimistic confirm/snooze mutations (M5).
 *
 * The service layer is mocked; what we lock down here is the cache behavior:
 * the tap must be reflected in the pending/detail caches immediately
 * (optimistic), and a server failure must restore the previous state
 * (rollback) — the patient never gets stuck looking at a wrong screen.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { eventKeys, useConfirmEvent, useSnoozeEvent } from '../useMedicationEvent';
import { confirmEvent, snoozeEvent } from '../../services/supabase/events';
import { AppError } from '../../services/supabase/errors';
import { useAuthStore } from '../../store/authStore';
import { useConfirmOutboxStore } from '../../store/confirmOutboxStore';
import type { MedicationEvent, User } from '../../types';

jest.mock('../../services/supabase/events', () => ({
  confirmEvent: jest.fn(),
  snoozeEvent: jest.fn(),
  getEventById: jest.fn(),
  getEventHistory: jest.fn(),
  getPendingEvent: jest.fn(),
}));

// authStore persists via SecureStore; keep rehydration synchronous and inert
// so no async native-module handle outlives the test worker.
jest.mock('../../lib/secureStorage', () => ({
  LargeSecureStore: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockConfirm = confirmEvent as jest.Mock;
const mockSnooze = snoozeEvent as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATIENT_ID = 'patient-1';

const patientProfile: User = {
  id: PATIENT_ID,
  email: 'p@test.dev',
  name: 'P',
  role: 'patient',
  created_at: '2026-01-01T00:00:00Z',
};

const pendingEvent: MedicationEvent = {
  id: 'evt-1',
  schedule_id: 'sch-1',
  medication_id: 'med-1',
  patient_id: PATIENT_ID,
  scheduled_time: '2026-07-07T08:00:00Z',
  status: 'pending',
  snooze_count: 1,
  created_at: '2026-07-07T00:00:00Z',
  medications: { name: 'TestMed', dosage: '5mg' },
};

const createdClients: QueryClient[] = [];

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  createdClients.push(qc);
  qc.setQueryData(eventKeys.pending(PATIENT_ID), pendingEvent);
  qc.setQueryData(eventKeys.byId('evt-1'), pendingEvent);

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  mockConfirm.mockReset();
  mockSnooze.mockReset();
  useAuthStore.setState({ profile: patientProfile, role: 'patient' });
  useConfirmOutboxStore.setState({ entries: [], flushing: false });
});

afterEach(() => {
  // QueryClient keeps GC/refetch timers alive — clear them so Jest can exit
  createdClients.splice(0).forEach((qc) => qc.clear());
});

// ── useConfirmEvent ───────────────────────────────────────────────────────────

describe('useConfirmEvent', () => {
  it('optimistically clears the pending reminder and marks the detail as taken', async () => {
    const { qc, wrapper } = setup();
    let resolveConfirm!: () => void;
    mockConfirm.mockImplementation(() => new Promise<void>((r) => (resolveConfirm = r)));

    const { result } = renderHook(() => useConfirmEvent(), { wrapper });
    act(() => result.current.mutate('evt-1'));

    // Before the server responds, the caches already reflect the tap
    await waitFor(() => {
      expect(qc.getQueryData(eventKeys.pending(PATIENT_ID))).toBeNull();
    });
    const detail = qc.getQueryData<MedicationEvent>(eventKeys.byId('evt-1'));
    expect(detail?.status).toBe('taken');
    expect(detail?.taken_time).toEqual(expect.any(String));

    act(() => resolveConfirm());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back both caches when the server rejects', async () => {
    const { qc, wrapper } = setup();
    mockConfirm.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useConfirmEvent(), { wrapper });
    act(() => result.current.mutate('evt-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(eventKeys.pending(PATIENT_ID))).toEqual(pendingEvent);
    expect(qc.getQueryData(eventKeys.byId('evt-1'))).toEqual(pendingEvent);
  });

  it('queues the confirm offline (network error) and still succeeds', async () => {
    const { qc, wrapper } = setup();
    mockConfirm.mockRejectedValue(new AppError('network'));

    const { result } = renderHook(() => useConfirmEvent(), { wrapper });
    act(() => result.current.mutate('evt-1'));

    // The tap is treated as done: mutation succeeds and the optimistic clear stays
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(eventKeys.pending(PATIENT_ID))).toBeNull();

    // Durably queued with a real tap time for later replay
    const { entries } = useConfirmOutboxStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].event_id).toBe('evt-1');
    expect(entries[0].taken_time).toEqual(expect.any(String));
  });
});

// ── useSnoozeEvent ────────────────────────────────────────────────────────────

describe('useSnoozeEvent', () => {
  it('optimistically increments snooze_count and sets status to snoozed', async () => {
    const { qc, wrapper } = setup();
    let resolveSnooze!: (value: MedicationEvent | null) => void;
    mockSnooze.mockImplementation(
      () => new Promise<MedicationEvent | null>((r) => (resolveSnooze = r))
    );

    const { result } = renderHook(() => useSnoozeEvent(), { wrapper });
    act(() => result.current.mutate('evt-1'));

    await waitFor(() => {
      const pending = qc.getQueryData<MedicationEvent>(eventKeys.pending(PATIENT_ID));
      expect(pending?.snooze_count).toBe(2);
    });
    expect(qc.getQueryData<MedicationEvent>(eventKeys.pending(PATIENT_ID))?.status).toBe('snoozed');
    expect(qc.getQueryData<MedicationEvent>(eventKeys.byId('evt-1'))?.snooze_count).toBe(2);

    act(() => resolveSnooze({ ...pendingEvent, status: 'snoozed', snooze_count: 2 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back the snooze count when the server rejects', async () => {
    const { qc, wrapper } = setup();
    mockSnooze.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useSnoozeEvent(), { wrapper });
    act(() => result.current.mutate('evt-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<MedicationEvent>(eventKeys.pending(PATIENT_ID))?.snooze_count).toBe(1);
    expect(qc.getQueryData<MedicationEvent>(eventKeys.byId('evt-1'))?.status).toBe('pending');
  });

  it('treats a null RPC result as success (dose already resolved elsewhere)', async () => {
    const { wrapper } = setup();
    mockSnooze.mockResolvedValue(null);

    const { result } = renderHook(() => useSnoozeEvent(), { wrapper });
    act(() => result.current.mutate('evt-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
