/**
 * Confirm-outbox semantics (M11) — the offline "I took my pill" guarantees:
 * success removes the entry, the tap-time is replayed verbatim, a second tap
 * doesn't overwrite the first, network failures back off, permanent failures
 * drop.
 */

jest.mock('../../services/supabase/events', () => ({
  confirmEvent: jest.fn(),
}));

import { confirmEvent } from '../../services/supabase/events';
import { AppError } from '../../services/supabase/errors';
import { useConfirmOutboxStore } from '../confirmOutboxStore';

const mockConfirm = confirmEvent as jest.Mock;

beforeEach(() => {
  mockConfirm.mockReset();
  useConfirmOutboxStore.setState({ entries: [], flushing: false });
});

describe('confirm outbox flush', () => {
  it('replays confirmEvent with the original tap time, then removes the entry', async () => {
    mockConfirm.mockResolvedValue(undefined);
    useConfirmOutboxStore.getState().enqueue('evt-1', '2026-07-08T08:00:00.000Z');

    await useConfirmOutboxStore.getState().flush();

    expect(mockConfirm).toHaveBeenCalledWith('evt-1', '2026-07-08T08:00:00.000Z');
    expect(useConfirmOutboxStore.getState().entries).toHaveLength(0);
  });

  it('dedupes on event_id — a second tap keeps the first tap time', () => {
    useConfirmOutboxStore.getState().enqueue('evt-1', '2026-07-08T08:00:00.000Z');
    useConfirmOutboxStore.getState().enqueue('evt-1', '2026-07-08T08:05:00.000Z');

    const { entries } = useConfirmOutboxStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].taken_time).toBe('2026-07-08T08:00:00.000Z');
  });

  it('keeps the entry with backoff on network failure and stops the pass', async () => {
    mockConfirm.mockRejectedValue(new AppError('network'));
    useConfirmOutboxStore.getState().enqueue('evt-1', '2026-07-08T08:00:00.000Z');
    useConfirmOutboxStore.getState().enqueue('evt-2', '2026-07-08T09:00:00.000Z');

    await useConfirmOutboxStore.getState().flush();

    const { entries } = useConfirmOutboxStore.getState();
    expect(entries).toHaveLength(2);
    expect(entries[0].attempts).toBe(1);
    expect(entries[0].next_attempt_at).toBeGreaterThan(Date.now());
    expect(mockConfirm).toHaveBeenCalledTimes(1); // pass stopped after the first
    expect(entries[1].attempts).toBe(0);
  });

  it('skips entries that are still backing off', async () => {
    mockConfirm.mockResolvedValue(undefined);
    useConfirmOutboxStore.getState().enqueue('evt-1', '2026-07-08T08:00:00.000Z');
    useConfirmOutboxStore.setState((state) => ({
      entries: state.entries.map((e) => ({ ...e, next_attempt_at: Date.now() + 60_000 })),
    }));

    await useConfirmOutboxStore.getState().flush();

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(useConfirmOutboxStore.getState().entries).toHaveLength(1);
  });

  it('drops entries that fail permanently (e.g. permission)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockConfirm.mockRejectedValue(new AppError('permission'));
    useConfirmOutboxStore.getState().enqueue('evt-1', '2026-07-08T08:00:00.000Z');

    await useConfirmOutboxStore.getState().flush();

    expect(useConfirmOutboxStore.getState().entries).toHaveLength(0);
    warnSpy.mockRestore();
  });
});
