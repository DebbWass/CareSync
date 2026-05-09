import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { fetchProfile } from '../services/supabase/auth';
import { registerPushToken, unregisterPushToken } from '../services/notifications/registration';

// Bootstraps auth state from Supabase and keeps the authStore in sync.
// Mount this once in the root layout.
export function useAuthListener() {
  const { setSession, setProfile, clearAuth, session } = useAuthStore();

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
          const profile = await fetchProfile(newSession.user.id);
          setProfile(profile);
          registerPushToken(newSession.user.id);
        }

        if (event === 'SIGNED_OUT') {
          if (session?.user?.id) {
            unregisterPushToken(session.user.id);
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
