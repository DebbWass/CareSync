import { useEffect, useState } from 'react';
import { Redirect, Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { useAuthStore } from '../src/store/authStore';
import { useAuthListener } from '../src/hooks/useAuth';
import { setupNotificationChannels } from '../src/services/notifications/channels';
import { queryClient } from '../src/lib/queryClient';
import type { NotificationData } from '../src/types/notifications';

// Remote push notifications are not supported in Expo Go SDK 53+
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const IS_NATIVE_MOBILE = Platform.OS === 'ios' || Platform.OS === 'android';

// How foreground notifications behave while the app is open (standalone only)
if (!IS_EXPO_GO && IS_NATIVE_MOBILE) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Watches auth state and redirects to the correct route group
function AuthGuard() {
  const { session, role } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !navigationState?.key) {
    return null;
  }

  const inAuthGroup = segments[0] === '(auth)';
  const inPatientGroup = segments[0] === '(patient)';
  const inCaregiverGroup = segments[0] === '(caregiver)';

  if (!session) {
    return inAuthGroup ? null : <Redirect href="/(auth)/login" />;
  }

  if (role === 'patient' && !inPatientGroup) {
    return <Redirect href="/(patient)" />;
  }

  if (role === 'caregiver' && !inCaregiverGroup) {
    return <Redirect href="/(caregiver)" />;
  }

  return null;
}

export default function RootLayout() {
  useAuthListener();

  useEffect(() => {
    if (!IS_EXPO_GO && IS_NATIVE_MOBILE) setupNotificationChannels().catch(() => {});
  }, []);

  // Handle notification taps (deep-link to reminder screen) — standalone builds only
  useEffect(() => {
    if (IS_EXPO_GO || !IS_NATIVE_MOBILE) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as unknown as NotificationData;

        if (data?.type === 'reminder' && data.event_id) {
          router.push(`/reminder/${data.event_id}`);
        }

        if (data?.type === 'alert') {
          router.push('/(caregiver)/alerts');
        }
      }
    );

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <AuthGuard />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(patient)" />
          <Stack.Screen name="(caregiver)" />
          <Stack.Screen
            name="reminder/[eventId]"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade',
            }}
          />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
