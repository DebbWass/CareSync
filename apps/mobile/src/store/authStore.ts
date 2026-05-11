import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User, UserRole } from '../types';

interface AuthState {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  role: UserRole | null;

  setSession: (session: Session | null) => void;
  setProfile: (profile: User | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      supabaseUser: null,
      profile: null,
      role: null,

      setSession: (session) =>
        set({
          session,
          supabaseUser: session?.user ?? null,
        }),

      setProfile: (profile) =>
        set({
          profile,
          role: profile?.role ?? null,
        }),

      clearAuth: () =>
        set({
          session: null,
          supabaseUser: null,
          profile: null,
          role: null,
        }),
    }),
    {
      name: 'caresync-auth',
      storage: createJSONStorage(() => ({
        getItem: (name: string) => SecureStore.getItemAsync(name),
        setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
        removeItem: (name: string) => SecureStore.deleteItemAsync(name),
      })),
      // Only persist the profile and role — session is managed by Supabase Auth
      partialize: (state) => ({
        profile: state.profile,
        role: state.role,
      }),
    }
  )
);
