/**
 * Language switching (M6).
 *
 * Switching does four things, in order of importance:
 *  1. Persist the choice locally (settingsStore) — must never be lost.
 *  2. Swap the live i18n language — text updates immediately.
 *  3. Persist to users.language — the scheduler localizes push copy from it
 *     (best-effort: an offline failure must not block the switch; the local
 *     language still applies and the user is told the account copy may lag).
 *  4. Handle direction: forceRTL only takes effect on a native restart, so it
 *     is applied silently (no visual change now) and a restart is OFFERED.
 *     Declining is safe — the direction corrects on the next natural launch.
 */
import { Alert, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import i18n, { detectLanguage, isRTLLanguage } from '../i18n';
import { useSettingsStore, type AppLanguage } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { updateUserLanguage } from '../services/supabase/auth';

export function useLanguageSwitcher() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const userId = useAuthStore((s) => s.profile?.id);

  /** choice=null means "follow the device language". */
  const choose = async (choice: AppLanguage | null) => {
    const effective = choice ?? detectLanguage(null, getLocales()[0]?.languageCode);

    setLanguage(choice);
    await i18n.changeLanguage(effective);

    if (userId) {
      try {
        // Always write the EFFECTIVE language: push copy must match the app
        // even when the user chose "device language".
        await updateUserLanguage(userId, effective);
      } catch {
        Alert.alert(t('settings.title'), t('settings.languageChangeFailed'));
      }
    }

    const wantRTL = isRTLLanguage(effective);
    if (wantRTL !== I18nManager.isRTL) {
      // Applies on the next native start; harmless until then
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
      Alert.alert(t('settings.rtlRestartTitle'), t('settings.rtlRestartMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.rtlRestartConfirm'),
          onPress: () => {
            // Unavailable in Expo Go / some dev setups — the direction then
            // simply applies on the next manual restart
            Updates.reloadAsync().catch(() => {});
          },
        },
      ]);
    }
  };

  return { language, choose };
}
