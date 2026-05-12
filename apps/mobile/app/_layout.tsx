import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/queryClient';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/store/authStore';
import { getProfile } from '../src/services/supabase/auth';
import {
  configureForegroundNotifications,
  registerPushToken,
} from '../src/services/notifications/pushTokenService';
import { Colors } from '../src/constants/colors';

// Configure foreground notification display behavior at module load time
configureForegroundNotifications();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.primary,
    onPrimary: Colors.light.onPrimary,
  },
};

/**
 * AuthGate sits inside the provider tree and handles:
 * - Loading the initial Supabase session
 * - Listening for auth state changes (sign in / sign out / token refresh)
 * - Redirecting to the correct route group based on session + role
 */
function AuthGate() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { session, role, setSession, setProfile, clearAuth } = useAuthStore();
  const readyRef = useRef(false); // guard so onAuthStateChange skips initial load

  useEffect(() => {
    // 1. Resolve the initial persisted session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        if (profile) {
          setProfile(profile);
          // Register push token silently — failure is non-fatal
          registerPushToken(session.user.id).catch((err) =>
            console.warn('[layout] Push token registration failed:', err)
          );
        }
      }
      readyRef.current = true;
      setIsReady(true);
    });

    // 2. React to subsequent auth events (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!readyRef.current) return; // initial session handled above
      setSession(session);
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        if (profile) {
          setProfile(profile);
          // Re-register on new sign-in (token may have changed)
          registerPushToken(session.user.id).catch((err) =>
            console.warn('[layout] Push token registration failed:', err)
          );
        }
      } else {
        clearAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setProfile, clearAuth]);

  // 3. Route guard — runs whenever session/role/segments change
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      // Not logged in → send to login
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (role) {
      // Logged in → send away from auth screens to correct role group
      if (inAuthGroup) {
        router.replace(role === 'patient' ? '/(patient)' : '/(caregiver)');
      }
    }
  }, [isReady, session, role, segments, router]);

  // Show a branded loading screen while we resolve the session
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.light.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={Colors.light.onPrimary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <StatusBar style="light" />
        <AuthGate />
      </PaperProvider>
    </QueryClientProvider>
  );
}
