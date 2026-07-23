import { LogBox } from 'react-native';
import Constants from 'expo-constants';

// Expo Go (SDK 53+) no longer supports remote push notifications, so
// expo-notifications emits a warning at import time via its
// TokenAutoRegistration side effect — regardless of whether we call any push
// APIs (our real push calls are already guarded behind !IS_EXPO_GO). The
// warning is dev-only and never fires in a development or production build.
//
// Silence only this one message, and only in Expo Go, so no other logs are
// hidden. This module must be imported before expo-notifications so the ignore
// pattern is registered before the warning is emitted.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

if (IS_EXPO_GO) {
  LogBox.ignoreLogs([/Android Push notifications .* was removed from Expo Go/]);
}
