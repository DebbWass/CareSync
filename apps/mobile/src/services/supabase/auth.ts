import { supabase } from '../../lib/supabase';
import type { UserRole, User } from '../../types';

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
      // Passed to the handle_new_user() DB trigger
      data: { name, role },
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as User;
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
