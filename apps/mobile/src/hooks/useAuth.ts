import { useEffect } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { fetchProfile } from '../services/supabase/auth';
import { registerPushToken, unregisterPushToken } from '../services/notifications/registration';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Bootstraps auth state from Supabase and keeps the authStore in sync.
// Mount this once in the root layout.
export function useAuthListener() {
  const { setSession, setProfile, clearAuth } = useAuthStore();

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        fetchProfile(data.session.user.id)
          .then(setProfile)
          .catch(() => {
            // Profile fetch failed — session may be stale
            clearAuth();
          });
      }
    });

    // Listen for sign-in, sign-out, and token refresh events
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          try {
            const profile = await fetchProfile(newSession.user.id);
            setProfile(profile);
            if (!IS_EXPO_GO) {
              await registerPushToken(newSession.user.id);
            }
          } catch {
            // Keep auth state coherent if profile bootstrap fails.
            clearAuth();
          }
        }

        if (event === 'SIGNED_OUT') {
          const signedOutUserId = useAuthStore.getState().supabaseUser?.id;
          if (!IS_EXPO_GO && signedOutUserId) {
            await unregisterPushToken(signedOutUserId);
          }
          clearAuth();
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
