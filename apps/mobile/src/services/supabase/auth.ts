import { supabase } from '../../lib/supabase';
import type { User, UserRole } from '../../types';

/**
 * Sign in with email and password.
 * The root layout's onAuthStateChange listener handles post-login navigation.
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Register a new user. Passes name and role as metadata so the DB trigger
 * (handle_new_user) can populate the public.users table automatically.
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  role: UserRole
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role },
    },
  });
  if (error) throw error;
  return data;
}

/** Sign out the current user. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Fetch the public.users profile row for a given auth user ID.
 * Returns null if not found (e.g. trigger hasn't run yet after signUp).
 */
export async function getProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116 = "no rows returned" — normal on first login before trigger fires
    if (error.code !== 'PGRST116') {
      console.warn('[Auth] Failed to fetch profile:', error.message);
    }
    return null;
  }
  return data as User;
}
