/**
 * Unit tests for src/services/supabase/patients.ts — invite / accept / cancel.
 * The Supabase client is mocked; no real network calls.
 */

/* eslint-disable no-var */
var mockRpc: jest.Mock;
var mockFrom: jest.Mock;
var mockInsert: jest.Mock;
var mockUpdate: jest.Mock;
// Result the chainable update(...).eq()...(.select()) resolves to.
var mockUpdateResult: { data: unknown; error: unknown };
/* eslint-enable no-var */

jest.mock('../../../lib/supabase', () => {
  mockRpc = jest.fn();
  mockInsert = jest.fn();
  mockUpdateResult = { data: null, error: null };

  // Chainable, thenable stand-in for the PostgREST update builder: every
  // filter returns `this`, and awaiting anywhere in the chain yields mockUpdateResult.
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['eq', 'neq', 'select']) chain[m] = jest.fn(() => chain);
    chain.then = (resolve: (v: unknown) => unknown) => resolve(mockUpdateResult);
    return chain;
  };
  mockUpdate = jest.fn(() => makeChain());
  mockFrom = jest.fn(() => ({
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  }));

  return {
    supabase: {
      rpc: (...args: unknown[]) => mockRpc(...args),
      from: (...args: unknown[]) => mockFrom(...args),
    },
  };
});

import {
  invitePatientByEmail,
  getPatientInvitations,
  respondToInvitation,
  cancelInvitation,
} from '../patients';

const CAREGIVER_ID = 'caregiver-1';
const PATIENT_ID = 'a3acb5b3-4f58-47b1-a944-d824dd27bebe';
const REL_ID = 'rel-1';

beforeEach(() => {
  mockRpc.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockClear();
  mockFrom.mockClear();
  mockUpdateResult = { data: null, error: null };
});

describe('invitePatientByEmail', () => {
  it('resolves the patient via RPC (bypassing RLS) and inserts the relationship', async () => {
    mockRpc.mockResolvedValue({ data: PATIENT_ID, error: null });
    mockInsert.mockResolvedValue({ error: null });

    await invitePatientByEmail(CAREGIVER_ID, '  DoritWasserman@Gmail.com ');

    expect(mockRpc).toHaveBeenCalledWith('find_patient_id_by_email', {
      p_email: 'doritwasserman@gmail.com',
    });
    expect(mockInsert).toHaveBeenCalledWith({
      patient_id: PATIENT_ID,
      caregiver_id: CAREGIVER_ID,
    });
    expect(mockUpdate).not.toHaveBeenCalled(); // fresh invite — no revive path
  });

  it('throws notFound when no patient exists for the email', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(invitePatientByEmail(CAREGIVER_ID, 'nobody@example.com')).rejects.toMatchObject({
      code: 'notFound',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('surfaces a normalized error when the lookup RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('Network request failed') });

    await expect(invitePatientByEmail(CAREGIVER_ID, 'x@example.com')).rejects.toMatchObject({
      code: 'network',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('revives a previously cancelled invite (conflict → reset to pending)', async () => {
    mockRpc.mockResolvedValue({ data: PATIENT_ID, error: null });
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    mockUpdateResult = { data: [{ id: REL_ID }], error: null }; // a non-active row was revived

    await expect(invitePatientByEmail(CAREGIVER_ID, 'dorit@example.com')).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('reports conflict when an ACTIVE link already exists (nothing to revive)', async () => {
    mockRpc.mockResolvedValue({ data: PATIENT_ID, error: null });
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    mockUpdateResult = { data: [], error: null }; // neq('status','active') matched no rows

    await expect(invitePatientByEmail(CAREGIVER_ID, 'dorit@example.com')).rejects.toMatchObject({
      code: 'conflict',
    });
  });
});

describe('respondToInvitation', () => {
  it('accepts by setting the relationship to active', async () => {
    await respondToInvitation(REL_ID, true);
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'active' });
  });

  it('declines by setting the relationship to revoked', async () => {
    await respondToInvitation(REL_ID, false);
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'revoked' });
  });

  it('throws a normalized error on failure', async () => {
    mockUpdateResult = { data: null, error: { code: '42501', message: 'denied' } };
    await expect(respondToInvitation(REL_ID, true)).rejects.toMatchObject({ code: 'permission' });
  });
});

describe('cancelInvitation', () => {
  it('withdraws a pending invite by revoking it', async () => {
    await cancelInvitation(REL_ID);
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'revoked' });
  });
});

describe('getPatientInvitations', () => {
  it('returns the invitations from the RPC', async () => {
    const rows = [
      {
        relationship_id: REL_ID,
        caregiver_id: CAREGIVER_ID,
        caregiver_name: 'Dorit',
        caregiver_email: 'dorit@example.com',
        created_at: '2026-07-23T00:00:00Z',
      },
    ];
    mockRpc.mockResolvedValue({ data: rows, error: null });

    await expect(getPatientInvitations()).resolves.toEqual(rows);
    expect(mockRpc).toHaveBeenCalledWith('get_patient_invitations');
  });

  it('returns an empty array when there are none', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(getPatientInvitations()).resolves.toEqual([]);
  });
});
