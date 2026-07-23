import { supabase } from '../../lib/supabase';
import { AppError, normalizeSupabaseError } from './errors';
import type { User, UserRole } from '../../types';

// Deep link the password-recovery email redirects back to. Must stay listed in
// supabase/config.toml `additional_redirect_urls` and match app.json `scheme`.
export const RESET_PASSWORD_REDIRECT = 'caresync://reset-password';

/**
 * Sign in with email and password.
 * The root layout's onAuthStateChange listener handles post-login navigation.
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw normalizeSupabaseError(error);
  return data;
}

/**
 * Register a new user. Passes name and role as metadata so the DB trigger
 * (handle_new_user) can populate the public.users table automatically.
 */
export async function signUp(email: string, password: string, name: string, role: UserRole) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role },
    },
  });

  if (error) throw normalizeSupabaseError(error);

  // Enforce unique email regardless of backend config. With email
  // confirmations OFF, GoTrue rejects a duplicate outright (handled above).
  // With confirmations ON, GoTrue's anti-enumeration path instead returns a
  // *fake* user with an EMPTY identities array (never a real one for a genuine
  // new signup) — detect that and surface the same "email in use" message so a
  // second account can never be silently opened on an existing address.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AppError('emailInUse');
  }

  return data;
}

/** Sign out the current user. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw normalizeSupabaseError(error);
}

/**
 * Whether an account exists for this email. Backed by the SECURITY DEFINER
 * `email_exists` RPC (callable by anon) so the pre-login forgot-password and
 * register screens can give a definite answer.
 *
 * NOTE: this is deliberately enumerable — a product decision (2026-07-22) that
 * overrides GoTrue's default anti-enumeration stance. See the RPC migration
 * (20260722000001_email_exists_rpc.sql) for the rationale and how to revert.
 */
export async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_exists', {
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw normalizeSupabaseError(error);
  return data === true;
}

/**
 * Send a password-recovery email. The caller (forgot-password screen) checks
 * emailExists() first and shows an explicit "no account" message, so by the
 * time this runs the address is known to exist.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: RESET_PASSWORD_REDIRECT,
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Set a new password for the currently authenticated (recovery) session. */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw normalizeSupabaseError(error);
}

// ── Recovery deep-link parsing ────────────────────────────────────────────────

export type RecoveryUrlResult =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; errorCode: string }
  | { kind: 'none' };

/**
 * Parse the URL the recovery email redirects to. GoTrue (implicit flow) puts
 * the result in the URL *fragment*:
 *   caresync://reset-password#access_token=…&refresh_token=…&type=recovery
 * or, when the link is stale:
 *   caresync://reset-password#error=access_denied&error_code=otp_expired&…
 * Parsed manually — React Native's URLSearchParams is not reliable.
 */
export function parseRecoveryUrl(url: string): RecoveryUrlResult {
  const fragment = url.split('#')[1];
  if (!fragment) return { kind: 'none' };

  const params: Record<string, string> = {};
  for (const pair of fragment.split('&')) {
    const [key, ...rest] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
  }

  if (params.error_code || params.error) {
    return { kind: 'error', errorCode: params.error_code ?? params.error };
  }
  if (params.access_token && params.refresh_token) {
    return {
      kind: 'tokens',
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
    };
  }
  return { kind: 'none' };
}

/**
 * Install the recovery session carried by a reset-password deep link so
 * updateUser({ password }) is authorized. Returns true when a session was
 * installed, false when the URL carried nothing usable; throws AppError
 * ('expiredLink' for stale links) on failure.
 */
export async function restoreSessionFromRecoveryUrl(url: string): Promise<boolean> {
  const parsed = parseRecoveryUrl(url);

  if (parsed.kind === 'error') {
    throw normalizeSupabaseError({ code: parsed.errorCode, message: 'recovery link error' });
  }
  if (parsed.kind === 'none') return false;

  const { error } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });
  if (error) throw normalizeSupabaseError(error);
  return true;
}

/**
 * Persist the user's language on their profile. The scheduler reads
 * users.language to localize push-notification copy, so this must track the
 * app language — otherwise reminders arrive in the wrong language.
 */
export async function updateUserLanguage(userId: string, language: 'he' | 'en') {
  const { error } = await supabase.from('users').update({ language }).eq('id', userId);
  if (error) throw normalizeSupabaseError(error);
}

// ── Profile bootstrap ─────────────────────────────────────────────────────────

/**
 * Fetch the public.users profile row for a given auth user ID.
 * Returns null if not found (e.g. trigger hasn't run yet after signUp).
 */
export async function getProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

  if (error) {
    // PGRST116 = "no rows returned" — normal on first login before trigger fires
    if (error.code !== 'PGRST116') {
      console.warn('[Auth] Failed to fetch profile:', error.message);
    }
    return null;
  }
  return data as User;
}

/**
 * getProfile with a short retry. Right after signup the handle_new_user
 * trigger may not have committed yet; without the retry a fresh user gets
 * bounced straight back to the login screen (auth listener treats a missing
 * profile as an unusable session).
 */
export async function getProfileWithRetry(
  userId: string,
  attempts = 3,
  delayMs = 700
): Promise<User | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const profile = await getProfile(userId);
    if (profile) return profile;
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}
