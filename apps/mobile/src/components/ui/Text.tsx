import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useSettingsStore } from '../../store/settingsStore';
import { Colors } from '../../constants/colors';

interface Props extends TextProps {
  size?: number;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

const weightMap = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Accessible Text component that respects the user's font scale preference.
export function Text({
  size = 16,
  weight = 'regular',
  color,
  align = 'left',
  style,
  ...props
}: Props) {
  const { fontScale, highContrastMode } = useSettingsStore();
  const theme = highContrastMode ? Colors.highContrast : Colors.light;

  return (
    <RNText
      {...props}
      style={[
        {
          fontSize: size * fontScale,
          fontWeight: weightMap[weight],
          color: color ?? theme.onBackground,
          textAlign: align,
          lineHeight: size * fontScale * 1.4,
        },
        style,
      ]}
    />
  );
}
