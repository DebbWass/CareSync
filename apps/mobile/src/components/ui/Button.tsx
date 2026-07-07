import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { Text } from './Text';
import { Colors, ThemeColors } from '../../constants/colors';
import { MIN_TOUCH_TARGET_DP, PATIENT_PRIMARY_BUTTON_HEIGHT_DP } from '../../constants/config';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'confirm' | 'snooze' | 'danger' | 'outline';
  size?: 'default' | 'large'; // 'large' = patient-app primary button
  /** Label font size override (defaults: 28 for large, 16 for default). */
  textSize?: number;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function variantColors(theme: ThemeColors): Record<string, { bg: string; text: string }> {
  return {
    primary: { bg: theme.primary, text: theme.onPrimary },
    confirm: { bg: theme.confirm, text: theme.onConfirm },
    snooze: { bg: theme.snooze, text: theme.onSnooze },
    danger: { bg: theme.danger, text: theme.onDanger },
    outline: { bg: 'transparent', text: theme.primary },
  };
}

// Accessible button with enforced minimum touch targets.
// Use variant='confirm' + size='large' for the patient reminder screen.
// Colors follow the active theme so high-contrast mode applies everywhere.
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  textSize,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;
  const colors = variantColors(theme)[variant];
  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          minHeight: isLarge ? PATIENT_PRIMARY_BUTTON_HEIGHT_DP : MIN_TOUCH_TARGET_DP,
          borderRadius: isLarge ? 16 : 10,
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: variant === 'outline' ? theme.primary : undefined,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text
          size={textSize ?? (isLarge ? 28 : 16)}
          weight="bold"
          color={colors.text}
          align="center"
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
