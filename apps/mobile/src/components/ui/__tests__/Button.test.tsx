import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';
import { MIN_TOUCH_TARGET_DP } from '../../../constants/config';

describe('Button accessibility', () => {
  it('exposes role=button and uses the label as accessibilityLabel by default', () => {
    render(<Button label="Confirm" onPress={jest.fn()} />);
    const button = screen.getByRole('button', { name: 'Confirm' });
    expect(button).toBeTruthy();
  });

  it('prefers an explicit accessibilityLabel and forwards the hint', () => {
    render(
      <Button
        label="✓"
        onPress={jest.fn()}
        accessibilityLabel="Confirm medication taken"
        accessibilityHint="Marks this dose as taken"
      />
    );
    const button = screen.getByLabelText('Confirm medication taken');
    expect(button.props.accessibilityHint).toBe('Marks this dose as taken');
  });

  it('reports disabled and busy state to screen readers while loading', () => {
    render(<Button label="Save" onPress={jest.fn()} loading />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('meets the WCAG minimum touch target by default', () => {
    render(<Button label="Save" onPress={jest.fn()} />);
    const styles = StyleSheetFlatten(screen.getByRole('button').props.style);
    expect(styles.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_DP);
  });

  it('uses the 80dp elderly-patient target for size=large', () => {
    render(<Button label="Take medication" onPress={jest.fn()} size="large" />);
    const styles = StyleSheetFlatten(screen.getByRole('button').props.style);
    expect(styles.minHeight).toBeGreaterThanOrEqual(80);
  });
});

/** Flatten a React Native style array into a single object. */
function StyleSheetFlatten(style: unknown): Record<string, number> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native').StyleSheet.flatten(style);
}
