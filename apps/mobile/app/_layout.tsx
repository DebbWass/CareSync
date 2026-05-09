import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { useAuthStore } from '../src/store/authStore';
import { useAuthListener } from '../src/hooks/useAuth';
import { setupNotificationChannels } from '../src/services/notifications/channels';
import { queryClient } from '../src/lib/queryClient';
import type { NotificationData } from '../src/types/notifications';

// How foreground notifications behave while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Watches auth state and redirects to the correct route group
function AuthGuard() {
  const { session, role } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inPatientGroup = segments[0] === '(patient)';
    const inCaregiverGroup = segments[0] === '(caregiver)';

    if (!session) {
      // Not logged in — send to login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Logged in — redirect to correct role group if not already there
    if (role === 'patient' && !inPatientGroup) {
      router.replace('/(patient)/');
    } else if (role === 'caregiver' && !inCaregiverGroup) {
      router.replace('/(caregiver)/');
    }
  }, [session, role, segments]);

  return null;
}

export default function RootLayout() {
  useAuthListener();

  useEffect(() => {
    setupNotificationChannels();
  }, []);

  // Handle notification taps (deep-link to reminder screen)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as NotificationData;

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
