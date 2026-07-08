/**
 * Unit tests for src/services/supabase/events.ts
 *
 * Focus: the snooze_event RPC contract (M5) — atomicity moved into the
 * database, so the client's job is (1) call the RPC, (2) pass through the
 * null "no longer snoozable" outcome, (3) normalize real errors to AppError.
 */

// ── Supabase client mock ──────────────────────────────────────────────────────
/* eslint-disable no-var */
var mockRpc: jest.Mock;
var mockFrom: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../../lib/supabase', () => {
  mockRpc = jest.fn();
  mockFrom = jest.fn();

  return {
    supabase: {
      rpc: (...args: unknown[]) => mockRpc(...args),
      from: (...args: unknown[]) => mockFrom(...args),
    },
  };
});

import { confirmEvent, snoozeEvent } from '../events';
import { AppError } from '../errors';

// ── snoozeEvent ───────────────────────────────────────────────────────────────

describe('snoozeEvent', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls the atomic snooze_event RPC with the event id', async () => {
    const row = { id: 'evt-1', status: 'snoozed', snooze_count: 2 };
    mockRpc.mockResolvedValue({ data: row, error: null });

    const result = await snoozeEvent('evt-1');

    expect(mockRpc).toHaveBeenCalledWith('snooze_event', { p_event_id: 'evt-1' });
    expect(result).toEqual(row);
  });

  it('returns null when the event was no longer snoozable (not an error)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(snoozeEvent('evt-1')).resolves.toBeNull();
  });

  it('throws a normalized AppError on RPC failure', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(snoozeEvent('evt-1')).rejects.toMatchObject({
      name: 'AppError',
      code: 'permission',
      messageKey: 'errors.permission',
    });
  });

  it('never performs a read-then-write (no .from() usage)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await snoozeEvent('evt-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── confirmEvent ──────────────────────────────────────────────────────────────

describe('confirmEvent', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('sets status=taken, guards on status<>taken, and defaults taken_time to now', async () => {
    const neq = jest.fn().mockResolvedValue({ error: null });
    const eq = jest.fn().mockReturnValue({ neq });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    await confirmEvent('evt-1');

    expect(mockFrom).toHaveBeenCalledWith('medication_events');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'taken', taken_time: expect.any(String) })
    );
    expect(eq).toHaveBeenCalledWith('id', 'evt-1');
    // Idempotent replay guard: never re-touch an already-taken dose
    expect(neq).toHaveBeenCalledWith('status', 'taken');
  });

  it('replays the provided tap time verbatim (offline outbox)', async () => {
    const neq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ neq }) });
    mockFrom.mockReturnValue({ update });

    await confirmEvent('evt-1', '2026-07-08T08:00:00.000Z');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'taken', taken_time: '2026-07-08T08:00:00.000Z' })
    );
  });

  it('throws AppError when the update fails', async () => {
    const neq = jest.fn().mockResolvedValue({
      error: { message: 'Network request failed' },
    });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ neq }) });
    mockFrom.mockReturnValue({ update });

    await expect(confirmEvent('evt-1')).rejects.toBeInstanceOf(AppError);
  });
});
