/**
 * App-wide error boundary (M11).
 *
 * A render-time crash anywhere in the tree would otherwise unmount to a blank
 * white screen — for an elderly patient staring at a reminder, that is a dose
 * silently lost. This catches the throw and shows a calm, localized recovery
 * screen with one large "Try again" button that re-mounts the subtree.
 *
 * It is a class component (only class lifecycles catch render errors), so it
 * reads i18n and colors directly instead of through hooks. Kept dependency-free
 * of Paper so it still renders even if a provider is what failed.
 */
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import i18n from '../../i18n';
import { Colors } from '../../constants/colors';
import { FontSizes, FontWeights } from '../../constants/typography';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Surfaced to the console (and any crash reporter wired in later); the
    // no-console rule allows error().
    console.error('[ErrorBoundary] uncaught render error:', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const theme = Colors.light;
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Text style={styles.icon} accessibilityElementsHidden>
          ⚠️
        </Text>
        <Text style={[styles.title, { color: theme.onBackground }]} accessibilityRole="header">
          {i18n.t('errors.boundary.title')}
        </Text>
        <Text style={[styles.message, { color: theme.secondary }]}>
          {i18n.t('errors.boundary.message')}
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={this.handleRetry}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('errors.boundary.retry')}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {i18n.t('errors.boundary.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: FontSizes.patient.heading,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSizes.caregiver.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    minHeight: 56,
    minWidth: 200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  buttonText: {
    fontSize: FontSizes.caregiver.title,
    fontWeight: FontWeights.bold,
  },
});
