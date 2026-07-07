/**
 * Direction-aware glyphs (M6). React Native mirrors layout in RTL but never
 * text characters — a "forward" arrow or chevron must flip in code.
 */
import { I18nManager } from 'react-native';

/** "forward" arrow: → in LTR, ← in RTL */
export function forwardArrow(): string {
  return I18nManager.isRTL ? '←' : '→';
}

/** "forward" chevron for list rows: › in LTR, ‹ in RTL */
export function forwardChevron(): string {
  return I18nManager.isRTL ? '‹' : '›';
}
