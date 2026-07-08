/**
 * Outbox semantics tests (M9) — the offline-send guarantees:
 * success/duplicate removes the entry, network failure backs off and stops
 * the pass, permanent failure drops the entry.
 */

jest.mock('../../services/supabase/messages', () => ({
  sendMessage: jest.fn(),
}));

import { sendMessage } from '../../services/supabase/messages';
import { AppError } from '../../services/supabase/errors';
import { useOutboxStore } from '../outboxStore';

const mockSend = sendMessage as jest.Mock;

const entry = (clientId: string) => ({
  client_id: clientId,
  patient_id: 'p1',
  caregiver_id: 'c1',
  sender_id: 'c1',
  body: `msg-${clientId}`,
});

beforeEach(() => {
  mockSend.mockReset();
  useOutboxStore.setState({ entries: [], flushing: false });
});

describe('outbox flush', () => {
  it('removes the entry on successful send', async () => {
    mockSend.mockResolvedValue({ id: 'm1' });
    useOutboxStore.getState().enqueue(entry('a'));

    await useOutboxStore.getState().flush();

    expect(useOutboxStore.getState().entries).toHaveLength(0);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'a' }));
  });

  it('removes the entry on duplicate (sendMessage returns null = already sent)', async () => {
    mockSend.mockResolvedValue(null);
    useOutboxStore.getState().enqueue(entry('a'));

    await useOutboxStore.getState().flush();

    expect(useOutboxStore.getState().entries).toHaveLength(0);
  });

  it('keeps the entry with backoff on network failure and stops the pass', async () => {
    mockSend.mockRejectedValue(new AppError('network'));
    useOutboxStore.getState().enqueue(entry('a'));
    useOutboxStore.getState().enqueue(entry('b'));

    await useOutboxStore.getState().flush();

    const { entries } = useOutboxStore.getState();
    expect(entries).toHaveLength(2);
    expect(entries[0].attempts).toBe(1);
    expect(entries[0].next_attempt_at).toBeGreaterThan(Date.now());
    // Offline: the second entry was never attempted (pass stopped early)
    expect(mockSend).toHaveBeenCalledTimes(1);
    // Second entry untouched — no attempt counted
    expect(entries[1].attempts).toBe(0);
  });

  it('skips entries that are still backing off', async () => {
    mockSend.mockResolvedValue({ id: 'm1' });
    useOutboxStore.getState().enqueue(entry('a'));
    useOutboxStore.setState((state) => ({
      entries: state.entries.map((e) => ({ ...e, next_attempt_at: Date.now() + 60_000 })),
    }));

    await useOutboxStore.getState().flush();

    expect(mockSend).not.toHaveBeenCalled();
    expect(useOutboxStore.getState().entries).toHaveLength(1);
  });

  it('drops entries that fail permanently (e.g. relationship revoked)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockSend.mockRejectedValue(new AppError('permission'));
    useOutboxStore.getState().enqueue(entry('a'));

    await useOutboxStore.getState().flush();

    expect(useOutboxStore.getState().entries).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('sends queued entries in order on a later flush', async () => {
    mockSend.mockResolvedValue({ id: 'ok' });
    useOutboxStore.getState().enqueue(entry('a'));
    useOutboxStore.getState().enqueue(entry('b'));

    await useOutboxStore.getState().flush();

    expect(mockSend.mock.calls.map((c) => c[0].client_id)).toEqual(['a', 'b']);
    expect(useOutboxStore.getState().entries).toHaveLength(0);
  });
});
