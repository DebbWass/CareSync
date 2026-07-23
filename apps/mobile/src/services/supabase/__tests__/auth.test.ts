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
var mockResetPasswordForEmail: jest.Mock;
var mockUpdateUser: jest.Mock;
var mockSetSession: jest.Mock;
var mockFrom: jest.Mock;
var mockRpc: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../../lib/supabase', () => {
  // jest.fn() inside the factory — these are independent of the outer variables
  mockSignInWithPassword = jest.fn();
  mockSignUp = jest.fn();
  mockSignOut = jest.fn();
  mockResetPasswordForEmail = jest.fn();
  mockUpdateUser = jest.fn();
  mockSetSession = jest.fn();
  mockFrom = jest.fn();
  mockRpc = jest.fn();

  return {
    supabase: {
      auth: {
        signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
        signUp: (...args: unknown[]) => mockSignUp(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
        resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
        updateUser: (...args: unknown[]) => mockUpdateUser(...args),
        setSession: (...args: unknown[]) => mockSetSession(...args),
      },
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  };
});

import {
  signIn,
  signOut,
  signUp,
  getProfile,
  getProfileWithRetry,
  emailExists,
  requestPasswordReset,
  updatePassword,
  parseRecoveryUrl,
  restoreSessionFromRecoveryUrl,
  RESET_PASSWORD_REDIRECT,
} from '../auth';

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

  it('rejects a duplicate email surfaced as empty identities (confirmations ON)', async () => {
    // GoTrue anti-enumeration returns a fake user with identities: [] instead
    // of an error when the address is already registered.
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u4', identities: [] }, session: null },
      error: null,
    });

    await expect(signUp('dup@example.com', 'pass', 'Dup', 'caregiver')).rejects.toMatchObject({
      code: 'emailInUse',
      messageKey: 'errors.emailInUse',
    });
  });

  it('allows a genuine new signup (identities present)', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u5', identities: [{ id: 'i1' }] }, session: { access_token: 't' } },
      error: null,
    });

    await expect(signUp('fresh@example.com', 'pass', 'Fresh', 'patient')).resolves.toBeDefined();
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

// ── getProfileWithRetry ───────────────────────────────────────────────────────

describe('getProfileWithRetry', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('retries until the profile appears (fresh-signup trigger lag)', async () => {
    const fakeProfile = { id: 'u1', email: 'a@b.c', name: 'A', role: 'patient' };
    const single = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: '' } })
      .mockResolvedValueOnce({ data: fakeProfile, error: null });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single,
    });

    const result = await getProfileWithRetry('u1', 3, 0);
    expect(result).toEqual(fakeProfile);
    expect(single).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts', async () => {
    const single = jest
      .fn()
      .mockResolvedValue({ data: null, error: { code: 'PGRST116', message: '' } });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single,
    });

    const result = await getProfileWithRetry('u1', 3, 0);
    expect(result).toBeNull();
    expect(single).toHaveBeenCalledTimes(3);
  });
});

// ── password reset ────────────────────────────────────────────────────────────

describe('emailExists', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls the email_exists RPC with a normalized email', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    const result = await emailExists('  Dorit@Example.com ');
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('email_exists', { p_email: 'dorit@example.com' });
  });

  it('returns false when the account does not exist', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(emailExists('nobody@example.com')).resolves.toBe(false);
  });

  it('throws a normalized error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('Network request failed') });
    await expect(emailExists('x@example.com')).rejects.toMatchObject({ code: 'network' });
  });
});

describe('requestPasswordReset', () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset();
  });

  it('sends the recovery email with the app deep-link redirect', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await requestPasswordReset('user@example.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: RESET_PASSWORD_REDIRECT,
    });
  });

  it('normalizes rate-limit errors', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { code: 'over_email_send_rate_limit', message: 'too many' },
    });

    await expect(requestPasswordReset('user@example.com')).rejects.toMatchObject({
      name: 'AppError',
      code: 'rateLimit',
      messageKey: 'errors.rateLimit',
    });
  });
});

describe('updatePassword', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
  });

  it('updates the password on the current session', async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });

    await updatePassword('new-password-123');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
  });

  it('maps same_password to a specific message', async () => {
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { code: 'same_password', message: 'same' },
    });

    await expect(updatePassword('unchanged')).rejects.toMatchObject({
      code: 'samePassword',
      messageKey: 'errors.samePassword',
    });
  });
});

// ── recovery deep-link parsing ────────────────────────────────────────────────

describe('parseRecoveryUrl', () => {
  it('extracts tokens from the URL fragment', () => {
    expect(
      parseRecoveryUrl(
        'caresync://reset-password#access_token=aaa.bbb.ccc&refresh_token=rrr&type=recovery'
      )
    ).toEqual({ kind: 'tokens', accessToken: 'aaa.bbb.ccc', refreshToken: 'rrr' });
  });

  it('surfaces GoTrue error codes (expired link)', () => {
    expect(
      parseRecoveryUrl(
        'caresync://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'
      )
    ).toEqual({ kind: 'error', errorCode: 'otp_expired' });
  });

  it('returns none for a URL without a fragment', () => {
    expect(parseRecoveryUrl('caresync://reset-password')).toEqual({ kind: 'none' });
  });

  it('returns none for a fragment missing either token', () => {
    expect(parseRecoveryUrl('caresync://reset-password#access_token=only')).toEqual({
      kind: 'none',
    });
  });
});

describe('restoreSessionFromRecoveryUrl', () => {
  beforeEach(() => {
    mockSetSession.mockReset();
  });

  it('installs the session from a token URL', async () => {
    mockSetSession.mockResolvedValue({ data: {}, error: null });

    const restored = await restoreSessionFromRecoveryUrl(
      'caresync://reset-password#access_token=aaa&refresh_token=rrr&type=recovery'
    );

    expect(restored).toBe(true);
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'aaa', refresh_token: 'rrr' });
  });

  it('returns false when the URL carries nothing usable', async () => {
    await expect(restoreSessionFromRecoveryUrl('caresync://reset-password')).resolves.toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('throws expiredLink for a stale recovery link', async () => {
    await expect(
      restoreSessionFromRecoveryUrl(
        'caresync://reset-password#error=access_denied&error_code=otp_expired'
      )
    ).rejects.toMatchObject({ code: 'expiredLink', messageKey: 'errors.expiredLink' });
  });
});
