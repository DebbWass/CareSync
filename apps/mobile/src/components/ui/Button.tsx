import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { Text } from './Text';
import { Colors } from '../../constants/colors';
import { MIN_TOUCH_TARGET_DP } from '../../constants/config';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'confirm' | 'snooze' | 'danger' | 'outline';
  size?: 'default' | 'large';   // 'large' = patient-app primary button
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const variantStyles: Record<string, { bg: string; text: string }> = {
  primary: { bg: Colors.light.primary, text: Colors.light.onPrimary },
  confirm: { bg: Colors.light.confirm, text: Colors.light.onConfirm },
  snooze:  { bg: Colors.light.snooze,  text: Colors.light.onSnooze  },
  danger:  { bg: Colors.light.danger,  text: Colors.light.onDanger  },
  outline: { bg: 'transparent',        text: Colors.light.primary   },
};

// Accessible button with enforced minimum touch targets.
// Use variant='confirm' + size='large' for the patient reminder screen.
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const colors = variantStyles[variant];
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
          minHeight: isLarge ? 80 : MIN_TOUCH_TARGET_DP,
          borderRadius: isLarge ? 16 : 10,
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: variant === 'outline' ? Colors.light.primary : undefined,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text
          size={isLarge ? 28 : 16}
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
