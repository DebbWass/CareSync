import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { Button } from './Button';
import { Colors } from '../../constants/colors';
import { AppError, normalizeSupabaseError } from '../../services/supabase/errors';

interface Props {
  /** Any error from a query hook or mutation; null/undefined renders nothing. */
  error: unknown;
  /** Optional retry action (usually the query's refetch). */
  onRetry?: () => void;
}

// Shared error state for screens: localized, screen-reader announced, with an
// optional retry. Always prefer this over ad-hoc Alert.alert / inline text so
// failures look and behave the same everywhere.
export function ErrorBanner({ error, onRetry }: Props) {
  const { t } = useTranslation();

  if (!error) return null;
  const appError = error instanceof AppError ? error : normalizeSupabaseError(error);

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={t(appError.messageKey)}
    >
      <Text size={16} color={Colors.light.onDanger} align="center" weight="semibold">
        {t(appError.messageKey)}
      </Text>
      {onRetry ? (
        <Button
          label={t('common.retry')}
          onPress={onRetry}
          variant="outline"
          style={styles.retryButton}
          accessibilityHint={t('errors.retryHint')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.danger,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    gap: 12,
  },
  retryButton: {
    backgroundColor: Colors.light.surface,
  },
});
