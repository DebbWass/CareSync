/**
 * Push token registration service.
 *
 * Call `registerPushToken(userId)` once after the user logs in.
 * It requests notification permissions, fetches the Expo push token,
 * and upserts it into the `push_tokens` table.
 *
 * Android requires a notification channel to be created before any
 * notification can display on the lock screen (IMPORTANCE_HIGH).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';

// Android notification channel — must match the `channelId` sent by Edge Functions
const ANDROID_CHANNEL_ID = 'medications';

/**
 * Creates the Android notification channel. Safe to call multiple times.
 * No-op on iOS.
 */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Medication Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });
}

/**
 * Request permissions, get the Expo push token, and upsert it in Supabase.
 *
 * @param userId - The authenticated user's UUID
 * @returns The Expo push token string, or null if permissions were denied
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // Ensure the Android channel exists
  await ensureNotificationChannel();

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[pushTokenService] Push notification permissions denied');
    return null;
  }

  // Get the Expo push token
  let tokenData: Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync({
      // projectId is read automatically from app.json's "extra.eas.projectId"
      // If not configured, this will throw — set it up via `eas init` or app.json
    });
  } catch (err) {
    console.error('[pushTokenService] Failed to get push token:', err);
    return null;
  }

  const token = tokenData.data;
  const platform = Platform.OS as 'ios' | 'android';

  // Upsert the token — on conflict (user_id, token) do nothing to avoid duplicates
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[pushTokenService] Failed to save push token:', error.message);
    return null;
  }

  return token;
}

/**
 * Set up foreground notification behavior.
 * Call this once at app startup (before the notification channel is needed).
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
