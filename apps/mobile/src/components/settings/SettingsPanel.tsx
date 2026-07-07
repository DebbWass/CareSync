/**
 * SettingsPanel — shared by the patient tab and the caregiver settings route.
 *
 * First UI for the settingsStore preferences (they existed store-only until
 * M6): language switcher, high-contrast toggle, text-size stepper. Sized for
 * elderly users on both sides — generous targets hurt nobody.
 */
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { Colors } from '../../constants/colors';
import { FontSizes } from '../../constants/typography';
import { MIN_TOUCH_TARGET_DP } from '../../constants/config';
import { useSettingsStore, type AppLanguage } from '../../store/settingsStore';
import { useLanguageSwitcher } from '../../hooks/useLanguage';

const FONT_SCALE_STEP = 0.25;
const FONT_SCALE_MIN = 1.0;
const FONT_SCALE_MAX = 2.0;

interface LanguageOption {
  value: AppLanguage | null;
  /** Language autonyms stay untranslated — עברית is always "עברית". */
  label: string;
}

export function SettingsPanel() {
  const { t } = useTranslation();
  const { highContrastMode, fontScale, setHighContrast, setFontScale } = useSettingsStore();
  const theme = highContrastMode ? Colors.highContrast : Colors.light;
  const { language, choose } = useLanguageSwitcher();

  const languageOptions: LanguageOption[] = [
    { value: null, label: t('settings.languageDevice') },
    { value: 'he', label: 'עברית' },
    { value: 'en', label: 'English' },
  ];

  const fontPercent = Math.round(fontScale * 100);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      {/* ── Language ─────────────────────────────────────────────────────────── */}
      <Text
        size={FontSizes.patient.caption}
        weight="semibold"
        color={theme.secondary}
        style={styles.sectionTitle}
        accessibilityRole="header"
      >
        {t('settings.languageTitle')}
      </Text>

      <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.languageGroupA11y')}>
        {languageOptions.map((option) => {
          const selected = language === option.value;
          return (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.languageRow,
                { backgroundColor: theme.surface, borderColor: theme.border },
                selected && { borderColor: theme.primary },
              ]}
              onPress={() => choose(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
            >
              <Text
                size={FontSizes.patient.body}
                weight={selected ? 'bold' : 'regular'}
                color={selected ? theme.primary : theme.onSurface}
              >
                {option.label}
              </Text>
              {/* Selection is shown by checkmark + weight, never color alone */}
              {selected ? (
                <Text size={FontSizes.patient.body} weight="bold" color={theme.primary}>
                  ✓
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Display ──────────────────────────────────────────────────────────── */}
      <Text
        size={FontSizes.patient.caption}
        weight="semibold"
        color={theme.secondary}
        style={styles.sectionTitle}
        accessibilityRole="header"
      >
        {t('settings.displayTitle')}
      </Text>

      <View
        style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.settingText}>
          <Text size={FontSizes.patient.body} color={theme.onSurface}>
            {t('settings.highContrast')}
          </Text>
          <Text size={FontSizes.patient.caption} color={theme.secondary}>
            {t('settings.highContrastHint')}
          </Text>
        </View>
        <Switch
          value={highContrastMode}
          onValueChange={setHighContrast}
          accessibilityLabel={t('settings.highContrast')}
          accessibilityHint={t('settings.highContrastHint')}
          trackColor={{ true: theme.primary, false: theme.border }}
        />
      </View>

      <View
        style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.settingText}>
          <Text size={FontSizes.patient.body} color={theme.onSurface}>
            {t('settings.textSize')}
          </Text>
          <Text size={FontSizes.patient.caption} color={theme.secondary}>
            {t('settings.textSizeValue', { percent: fontPercent })}
          </Text>
        </View>
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperButton, { borderColor: theme.primary }]}
            onPress={() => setFontScale(fontScale - FONT_SCALE_STEP)}
            disabled={fontScale <= FONT_SCALE_MIN}
            accessibilityRole="button"
            accessibilityLabel={t('settings.textSizeDecreaseA11y')}
            accessibilityState={{ disabled: fontScale <= FONT_SCALE_MIN }}
          >
            <Text
              size={20}
              weight="bold"
              color={fontScale <= FONT_SCALE_MIN ? theme.disabled : theme.primary}
            >
              A−
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stepperButton, { borderColor: theme.primary }]}
            onPress={() => setFontScale(fontScale + FONT_SCALE_STEP)}
            disabled={fontScale >= FONT_SCALE_MAX}
            accessibilityRole="button"
            accessibilityLabel={t('settings.textSizeIncreaseA11y')}
            accessibilityState={{ disabled: fontScale >= FONT_SCALE_MAX }}
          >
            <Text
              size={28}
              weight="bold"
              color={fontScale >= FONT_SCALE_MAX ? theme.disabled : theme.primary}
            >
              A+
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: MIN_TOUCH_TARGET_DP + 8,
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepperButton: {
    minWidth: MIN_TOUCH_TARGET_DP + 8,
    minHeight: MIN_TOUCH_TARGET_DP + 8,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
