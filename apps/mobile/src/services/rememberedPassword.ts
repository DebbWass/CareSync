/**
 * Remembered login password (convenience for the "Remember me" checkbox).
 *
 * WHY this exists: the primary user is an Alzheimer's patient who cannot
 * reliably recall their password. When "Remember me" is on we pre-fill BOTH
 * email and password so they only tap "Sign In".
 *
 * WHY SecureStore (not the settingsStore / AsyncStorage): a password is a
 * secret. SecureStore is backed by the iOS Keychain / Android Keystore, so the
 * value is encrypted at rest — never plaintext. The email pre-fill lives in the
 * (non-sensitive) settingsStore; the password lives here.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'caresync-remembered-password';
const IS_WEB = Platform.OS === 'web';

export async function getRememberedPassword(): Promise<string | null> {
  try {
    if (IS_WEB) return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

/** Pass a string to remember it, or null to forget it. Never throws. */
export async function setRememberedPassword(password: string | null): Promise<void> {
  try {
    if (IS_WEB) {
      if (password == null) globalThis.localStorage?.removeItem(KEY);
      else globalThis.localStorage?.setItem(KEY, password);
      return;
    }
    if (password == null) await SecureStore.deleteItemAsync(KEY);
    else await SecureStore.setItemAsync(KEY, password);
  } catch {
    // Best-effort convenience feature — a storage failure must never block login.
  }
}
