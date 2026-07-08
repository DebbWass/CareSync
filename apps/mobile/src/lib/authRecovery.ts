/**
 * Global 401 recovery (M11).
 *
 * Supabase-js refreshes tokens on its own, but some failures leave a session
 * that is authenticated locally yet rejected by the server — a password change
 * on another device, a revoked refresh token, a project key rotation. Those
 * surface as AppError('auth') on ordinary data calls, and without handling the
 * user would sit on a screen that errors forever.
 *
 * When that happens we sign out once: signOut() fires onAuthStateChange
 * ('SIGNED_OUT'), which clears the store and lets AuthGuard redirect to login.
 * A re-entrancy guard stops a burst of failing queries from stacking sign-out
 * calls, and we only act when a session actually exists (so the login screen's
 * own failures never trigger it).
 */
import { supabase } from './supabase';
import { useAuthStore } from '../store/authStore';

let handling = false;

export async function handleAuthError(): Promise<void> {
  if (handling) return;
  if (!useAuthStore.getState().session) return; // already signed out
  handling = true;
  try {
    await supabase.auth.signOut();
  } catch {
    // Offline or the call itself failed — clear locally so the guard still
    // redirects; the next successful launch reconciles with the server.
    useAuthStore.getState().clearAuth();
  } finally {
    handling = false;
  }
}
