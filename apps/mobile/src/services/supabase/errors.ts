/**
 * Central error normalization for the data layer.
 *
 * Every service throws an AppError instead of swallowing failures — a network
 * outage must surface as an error state in the UI, never as an empty list
 * (silent failure is indistinguishable from "no data", which in a medication
 * app means a caregiver could believe there is nothing to worry about).
 *
 * The messageKey maps to i18n resources under `errors.*`, so screens can
 * render a localized, non-technical message via <ErrorBanner/>.
 */

export type AppErrorCode =
  | 'network'
  | 'auth'
  | 'permission'
  | 'notFound'
  | 'conflict'
  | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** i18n key, e.g. 'errors.network' — always render via t(), never raw. */
  readonly messageKey: string;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, cause?: unknown) {
    const causeMessage =
      cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : code;
    super(causeMessage);
    this.name = 'AppError';
    this.code = code;
    this.messageKey = `errors.${code}`;
    this.cause = cause;
  }
}

/** Duck-type check for PostgREST / Supabase error objects. */
function errorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function errorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

/**
 * Convert any thrown value from a Supabase call into an AppError.
 * Idempotent: an AppError passes through unchanged.
 */
export function normalizeSupabaseError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const code = errorCode(err);
  const status = errorStatus(err);
  const message = err instanceof Error ? err.message : '';

  // Offline / DNS / fetch-level failures (supabase-js surfaces TypeError)
  if (
    message.includes('Network request failed') ||
    message.includes('Failed to fetch') ||
    message.includes('fetch failed') ||
    err instanceof TypeError
  ) {
    return new AppError('network', err);
  }

  // GoTrue auth failures
  if (status === 401 || (typeof err === 'object' && err !== null && '__isAuthError' in err)) {
    return new AppError('auth', err);
  }

  switch (code) {
    case 'PGRST116': // no rows where one was expected (.single())
      return new AppError('notFound', err);
    case '23505': // unique_violation
      return new AppError('conflict', err);
    case '42501': // insufficient_privilege (includes RLS denials)
      return new AppError('permission', err);
    case '23503': // foreign_key_violation
      return new AppError('conflict', err);
    default:
      return new AppError('unknown', err);
  }
}
