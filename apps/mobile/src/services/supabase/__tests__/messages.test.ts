/**
 * Unit tests for src/services/supabase/messages.ts (M9).
 * The load-bearing behavior: a duplicate send (23505) is SUCCESS, and
 * receipt updates are guarded so they can never move backward.
 */

/* eslint-disable no-var */
var mockFrom: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../../lib/supabase', () => {
  mockFrom = jest.fn();
  return {
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
  };
});

import { sendMessage, markMessageDelivered, markThreadRead } from '../messages';

const INPUT = {
  patient_id: 'p1',
  caregiver_id: 'c1',
  sender_id: 'c1',
  body: 'hello',
  client_id: 'client-uuid-1',
};

describe('sendMessage', () => {
  beforeEach(() => mockFrom.mockReset());

  it('inserts and returns the created row', async () => {
    const row = { ...INPUT, id: 'm1', status: 'sent' };
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    const result = await sendMessage(INPUT);

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(insert).toHaveBeenCalledWith(INPUT);
    expect(result).toEqual(row);
  });

  it('treats a 23505 duplicate as success (returns null, does not throw)', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) }),
    });

    await expect(sendMessage(INPUT)).resolves.toBeNull();
  });

  it('throws AppError for real failures', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) }),
    });

    await expect(sendMessage(INPUT)).rejects.toMatchObject({
      name: 'AppError',
      code: 'permission',
    });
  });
});

describe('receipt updates', () => {
  beforeEach(() => mockFrom.mockReset());

  function updateChain() {
    const chain: Record<string, jest.Mock> = {};
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.neq = jest.fn().mockImplementation(() => chain);
    // Awaiting the chain resolves the final builder
    (chain as unknown as { then: unknown }).then = (resolve: (v: unknown) => void) =>
      resolve({ error: null });
    mockFrom.mockReturnValue(chain);
    return chain;
  }

  it('markMessageDelivered only targets messages still in sent', async () => {
    const chain = updateChain();
    await markMessageDelivered('m1');
    expect(chain.update).toHaveBeenCalledWith({ status: 'delivered' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'm1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'sent');
  });

  it('markThreadRead excludes own messages and already-read rows', async () => {
    const chain = updateChain();
    await markThreadRead('p1', 'c1', 'c1');
    expect(chain.update).toHaveBeenCalledWith({ status: 'read' });
    expect(chain.neq).toHaveBeenCalledWith('sender_id', 'c1');
    expect(chain.neq).toHaveBeenCalledWith('status', 'read');
  });
});
