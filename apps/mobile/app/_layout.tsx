import '../src/lib/suppressExpoGoLogs'; // must precede expo-notifications import (side effect)
import { useEffect } from 'react';
import { Redirect, Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import '../src/i18n'; // side-effect init — must precede any useTranslation()
import { useAuthStore } from '../src/store/authStore';
import { useAuthListener } from '../src/hooks/useAuth';
import { useOutboxFlusher } from '../src/hooks/useOutbox';
import { RealtimeProvider } from '../src/components/providers/RealtimeProvider';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { setupNotificationChannels } from '../src/services/notifications/channels';
import { queryClient } from '../src/lib/queryClient';
import { setupOnlineManager } from '../src/lib/onlineManager';
import { Colors } from '../src/constants/colors';
import type { NotificationData } from '../src/types/notifications';

// Pause/resume React Query with real connectivity — runs before any query.
setupOnlineManager();

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

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.primary,
    onPrimary: Colors.light.onPrimary,
  },
};

// Watches auth state and redirects to the correct route group.
// Renders nothing until navigation is mounted AND the persisted session has
// been resolved, so users are never bounced to login during session restore.
function AuthGuard({ isAuthReady }: { isAuthReady: boolean }) {
  const { session, role } = useAuthStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // navigationState.key is only set once the root navigator has mounted —
  // redirecting before that throws "navigate before mounting" errors.
  if (!navigationState?.key || !isAuthReady) {
    return null;
  }

  const inAuthGroup = segments[0] === '(auth)';
  const inPatientGroup = segments[0] === '(patient)';
  const inCaregiverGroup = segments[0] === '(caregiver)';

  // The password-recovery deep link manages its own session (tokens arrive in
  // the URL); redirecting it — with or without a session — would break the flow.
  if (segments[0] === 'reset-password') {
    return null;
  }

  if (!session) {
    return inAuthGroup ? null : <Redirect href="/(auth)/login" />;
  }

  // Push-notification deep links — valid for a signed-in user of either
  // role; without this exception the role redirect below would bounce them.
  if (segments[0] === 'reminder' || segments[0] === 'message') {
    return null;
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
  const { isReady } = useAuthListener();

  useEffect(() => {
    if (!IS_EXPO_GO && IS_NATIVE_MOBILE) setupNotificationChannels().catch(() => {});
  }, []);

  // Handle notification taps (deep-link to reminder screen) — standalone builds only
  useEffect(() => {
    if (IS_EXPO_GO || !IS_NATIVE_MOBILE) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as unknown as NotificationData;

      if (data?.type === 'reminder' && data.event_id) {
        router.push(`/reminder/${data.event_id}`);
      }

      if (data?.type === 'alert') {
        router.push('/(caregiver)/alerts');
      }

      if (data?.type === 'message' && data.message_id) {
        router.push(`/message/${data.message_id}`);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <AuthGuard isAuthReady={isReady} />
          <RealtimeProvider />
          <OutboxFlusher />
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
            <Stack.Screen
              name="message/[messageId]"
              options={{
                presentation: 'fullScreenModal',
                animation: 'fade',
              }}
            />
            <Stack.Screen name="reset-password" />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Hook host: keeps the outbox NetInfo lifecycle out of RootLayout's own hooks
function OutboxFlusher() {
  useOutboxFlusher();
  return null;
}
