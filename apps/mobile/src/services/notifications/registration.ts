import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';

// Requests permission, gets the device push token, and saves it to push_tokens.
// Safe to call on every app launch — UPSERT prevents duplicates.
export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) {
    // Push notifications don't work in simulators
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // User denied — silently return. The app still works; they just won't get push reminders.
    return;
  }

  // Get the raw FCM (Android) or APNs (iOS) token for direct delivery
  const tokenData = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token: tokenData.data, platform },
      { onConflict: 'user_id,token' }
    );
}

// Removes the current device token from the DB on logout.
export async function unregisterPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', tokenData.data);
  } catch {
    // Token may already be gone — not a critical error
  }
}
