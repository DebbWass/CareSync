import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NOTIFICATION_CHANNELS } from '../../constants/config';

// Must be called once on app startup before any notifications fire.
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.medications, {
    name: 'Medication Reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1B6CA8',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.alerts, {
    name: 'Caregiver Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}
