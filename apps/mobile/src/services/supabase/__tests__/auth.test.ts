/**
 * Unit tests for src/services/supabase/auth.ts
 *
 * The Supabase client is mocked so no real network calls are made.
 *
 * IMPORTANT: jest.mock() is hoisted above all imports at compile time.
 * Variables passed into the mock factory must use `var` (not const/let) so
 * they are also hoisted and available when the factory runs.
 */

// ── Supabase client mock ──────────────────────────────────────────────────────
// Using `var` so the declarations are hoisted alongside jest.mock()
/* eslint-disable no-var */
var mockSignInWithPassword: jest.Mock;
var mockSignUp: jest.Mock;
var mockSignOut: jest.Mock;
var mockFrom: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../../lib/supabase', () => {
  // jest.fn() inside the factory — these are independent of the outer variables
  mockSignInWithPassword = jest.fn();
  mockSignUp = jest.fn();
  mockSignOut = jest.fn();
  mockFrom = jest.fn();

  return {
    supabase: {
      auth: {
        signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
        signUp: (...args: unknown[]) => mockSignUp(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
      },
      from: (...args: unknown[]) => mockFrom(...args),
    },
  };
});

import { signIn, signOut, signUp, getProfile } from '../auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a mock query chain that ends with .single() returning data/error. */
function mockQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ── signIn ────────────────────────────────────────────────────────────────────

describe('signIn', () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
  });

  it('returns data on success', async () => {
    const fakeData = { user: { id: 'u1' }, session: { access_token: 'tok' } };
    mockSignInWithPassword.mockResolvedValue({ data: fakeData, error: null });

    const result = await signIn('test@example.com', 'password123');
    expect(result).toEqual(fakeData);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('throws when Supabase returns an error', async () => {
    const fakeError = new Error('Invalid credentials');
    mockSignInWithPassword.mockResolvedValue({ data: null, error: fakeError });

    await expect(signIn('bad@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });
});

// ── signUp ────────────────────────────────────────────────────────────────────

describe('signUp', () => {
  beforeEach(() => {
    mockSignUp.mockReset();
  });

  it('passes name and role as metadata', async () => {
    const fakeData = { user: { id: 'u2' }, session: null };
    mockSignUp.mockResolvedValue({ data: fakeData, error: null });

    await signUp('new@example.com', 'pass', 'Alice', 'patient');

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'pass',
      options: {
        data: { name: 'Alice', role: 'patient' },
      },
    });
  });

  it('passes caregiver role correctly', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u3' }, session: null }, error: null });

    await signUp('carer@example.com', 'pass', 'Bob', 'caregiver');

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { data: { name: 'Bob', role: 'caregiver' } },
      })
    );
  });

  it('throws when Supabase returns an error', async () => {
    const fakeError = new Error('Email already registered');
    mockSignUp.mockResolvedValue({ data: null, error: fakeError });

    await expect(signUp('dup@example.com', 'pass', 'Dup', 'patient')).rejects.toThrow(
      'Email already registered'
    );
  });
});

// ── signOut ───────────────────────────────────────────────────────────────────

describe('signOut', () => {
  beforeEach(() => {
    mockSignOut.mockReset();
  });

  it('resolves without error on success', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('throws when Supabase returns an error', async () => {
    const fakeError = new Error('Sign out failed');
    mockSignOut.mockResolvedValue({ error: fakeError });
    await expect(signOut()).rejects.toThrow('Sign out failed');
  });
});

// ── getProfile ────────────────────────────────────────────────────────────────

describe('getProfile', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('returns the user profile on success', async () => {
    const fakeProfile = {
      id: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'patient',
      phone: null,
      created_at: '2026-01-01T00:00:00Z',
    };
    mockQueryChain({ data: fakeProfile, error: null });

    const result = await getProfile('u1');
    expect(result).toEqual(fakeProfile);
  });

  it('returns null on PGRST116 (no rows — trigger not yet run)', async () => {
    mockQueryChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } });

    const result = await getProfile('new-user-id');
    expect(result).toBeNull();
  });

  it('returns null on other DB errors (and logs warning)', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockQueryChain({ data: null, error: { code: '42P01', message: 'table not found' } });

    const result = await getProfile('u1');
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Auth] Failed to fetch profile:'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });

  it('queries the users table by id', async () => {
    const chain = mockQueryChain({ data: null, error: { code: 'PGRST116', message: '' } });

    await getProfile('abc-123');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(chain.eq).toHaveBeenCalledWith('id', 'abc-123');
  });
});
