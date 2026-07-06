import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { getProfile } from '../services/supabase/auth';
import { registerPushToken, unregisterPushToken } from '../services/notifications/registration';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Bootstraps auth state from Supabase and keeps the authStore in sync.
// Mount this once in the root layout.
// Returns `isReady` — true once the persisted session (and profile, if any)
// has been resolved, so the router can gate redirects until state is known.
export function useAuthListener(): { isReady: boolean } {
  const { setSession, setProfile, clearAuth } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const profile = await getProfile(data.session.user.id);
        if (profile) {
          setProfile(profile);
        } else {
          // Profile missing — session is unusable for role routing
          clearAuth();
        }
      }
      setIsReady(true);
    });

    // Listen for sign-in, sign-out, and token refresh events
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const profile = await getProfile(newSession.user.id);
          if (profile) {
            setProfile(profile);
            if (!IS_EXPO_GO) {
              // Push token registration failure is non-fatal
              await registerPushToken(newSession.user.id).catch(() => {});
            }
          } else {
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

  return { isReady };
}
