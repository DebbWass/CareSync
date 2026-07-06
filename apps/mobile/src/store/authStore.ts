import { create } from 'zustand/index.js';
import { persist, createJSONStorage } from 'zustand/middleware.js';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User, UserRole } from '../types';
import { LargeSecureStore } from '../lib/secureStorage';

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
      storage: createJSONStorage(() => LargeSecureStore),
      // Only persist the profile and role — session is managed by Supabase Auth
      partialize: (state) => ({
        profile: state.profile,
        role: state.role,
      }),
    }
  )
);
