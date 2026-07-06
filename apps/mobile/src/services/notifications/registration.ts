import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';

const IS_WEB = Platform.OS === 'web';

async function getPersistablePushToken(): Promise<string | null> {
  if (IS_WEB) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const hasRealProjectId = Boolean(projectId && projectId !== 'YOUR_EAS_PROJECT_ID');

  // Prefer Expo push tokens for cross-platform delivery through send-push.
  if (hasRealProjectId) {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    return expoToken.data;
  }

  // Fallback for local/dev environments without EAS project metadata.
  const deviceToken = await Notifications.getDevicePushTokenAsync();
  return deviceToken.data;
}

// Requests permission, gets the device push token, and saves it to push_tokens.
// Safe to call on every app launch — UPSERT prevents duplicates.
export async function registerPushToken(userId: string): Promise<void> {
  if (IS_WEB || !Device.isDevice) {
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

  const token = await getPersistablePushToken();
  if (!token) return;

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' });
}

// Removes the current device token from the DB on logout.
export async function unregisterPushToken(userId: string): Promise<void> {
  if (IS_WEB || !Device.isDevice) return;

  try {
    const token = await getPersistablePushToken();
    if (!token) return;

    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {
    // Token may already be gone — not a critical error
  }
}
