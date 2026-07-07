import { AppError, normalizeSupabaseError } from '../errors';

describe('normalizeSupabaseError', () => {
  it('passes an existing AppError through unchanged (idempotent)', () => {
    const original = new AppError('conflict');
    expect(normalizeSupabaseError(original)).toBe(original);
  });

  it.each([
    ['PGRST116', 'notFound'],
    ['23505', 'conflict'],
    ['23503', 'conflict'],
    ['42501', 'permission'],
  ])('maps PostgREST code %s to %s', (pgCode, appCode) => {
    const err = normalizeSupabaseError({ code: pgCode, message: 'db says no' });
    expect(err.code).toBe(appCode);
    expect(err.messageKey).toBe(`errors.${appCode}`);
  });

  it('maps fetch-level failures to network', () => {
    expect(normalizeSupabaseError(new TypeError('Network request failed')).code).toBe('network');
    expect(normalizeSupabaseError(new Error('Failed to fetch')).code).toBe('network');
  });

  it('maps 401 auth failures to auth', () => {
    expect(normalizeSupabaseError({ status: 401, message: 'JWT expired' }).code).toBe('auth');
  });

  it.each([
    ['invalid_credentials', 'invalidCredentials'],
    ['user_already_exists', 'emailInUse'],
    ['email_exists', 'emailInUse'],
    ['weak_password', 'weakPassword'],
    ['same_password', 'samePassword'],
    ['over_email_send_rate_limit', 'rateLimit'],
    ['over_request_rate_limit', 'rateLimit'],
    ['otp_expired', 'expiredLink'],
  ])('maps GoTrue code %s to %s', (gotrueCode, appCode) => {
    const err = normalizeSupabaseError({ code: gotrueCode, message: 'auth says no' });
    expect(err.code).toBe(appCode);
    expect(err.messageKey).toBe(`errors.${appCode}`);
  });

  it('specific GoTrue codes win over the generic 401 → auth mapping', () => {
    const err = normalizeSupabaseError({
      code: 'invalid_credentials',
      status: 400,
      __isAuthError: true,
      message: 'Invalid login credentials',
    });
    expect(err.code).toBe('invalidCredentials');
  });

  it('falls back to unknown for anything else', () => {
    const err = normalizeSupabaseError({ code: 'XX000', message: 'weird' });
    expect(err.code).toBe('unknown');
    expect(err.messageKey).toBe('errors.unknown');
  });

  it('preserves the original error as cause for debugging', () => {
    const cause = { code: '23505', message: 'duplicate key' };
    expect(normalizeSupabaseError(cause).cause).toBe(cause);
  });
});
