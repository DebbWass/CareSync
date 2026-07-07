/**
 * Deep-link reminder screen — entry point from push notifications.
 *
 * Push payload contains only `event_id` (no PHI — per NF-08).
 * This screen fetches the full event details from Supabase after the user taps.
 *
 * Deep-link URL: caresync://reminder/<eventId>
 */
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReminderCard } from '../../src/components/patient/ReminderCard';
import { Text } from '../../src/components/ui/Text';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { useConfirmEvent, useEventById, useSnoozeEvent } from '../../src/hooks/useMedicationEvent';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Colors } from '../../src/constants/colors';
import { FontSizes } from '../../src/constants/typography';

export default function ReminderDeepLink() {
  const { t } = useTranslation();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;

  const { data: event, isLoading, error, refetch } = useEventById(eventId ?? null);
  const confirm = useConfirmEvent();
  const snooze = useSnoozeEvent();

  const goHome = () => router.replace('/(patient)');

  const handleConfirm = () => {
    if (!event) return;
    confirm.mutate(event.id, { onSuccess: goHome });
  };

  const handleSnooze = (_minutes: number) => {
    if (!event) return;
    snooze.mutate(event.id, { onSuccess: goHome });
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ── Fetch failed (network, permission, …) ───────────────────────────────────
  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <ErrorBanner error={error} onRetry={refetch} />
        <View style={styles.center}>
          <GoHomeLink onPress={goHome} color={theme.primary} label={t('patient.reminder.goHome')} />
        </View>
      </View>
    );
  }

  // ── Not found (expired or already cleaned up) ───────────────────────────────
  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text
          size={FontSizes.patient.heading}
          weight="bold"
          color={theme.onBackground}
          align="center"
          accessibilityRole="alert"
        >
          {t('patient.reminder.notFoundTitle')}
        </Text>
        <Text size={FontSizes.patient.body} color={theme.secondary} align="center">
          {t('patient.reminder.notFoundBody')}
        </Text>
        <GoHomeLink onPress={goHome} color={theme.primary} label={t('patient.reminder.goHome')} />
      </View>
    );
  }

  // ── Already taken ───────────────────────────────────────────────────────────
  if (event.status === 'taken') {
    return (
      <View style={[styles.center, { backgroundColor: theme.confirm }]}>
        <Text size={72} weight="bold" color={theme.onConfirm}>
          ✓
        </Text>
        <Text
          size={FontSizes.patient.heading}
          weight="bold"
          color={theme.onConfirm}
          align="center"
          accessibilityRole="header"
        >
          {t('patient.reminder.alreadyTakenTitle')}
        </Text>
        <Text size={FontSizes.patient.body} color={theme.onConfirm} align="center">
          {t('patient.reminder.alreadyTakenBody')}
        </Text>
        <GoHomeLink onPress={goHome} color={theme.onConfirm} label={t('patient.reminder.goHome')} />
      </View>
    );
  }

  // ── Active reminder ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* A failed confirm/snooze rolls the card back — tell the patient why */}
      <ErrorBanner error={confirm.error ?? snooze.error} />
      <ReminderCard
        event={event}
        onConfirm={handleConfirm}
        onSnooze={handleSnooze}
        isConfirming={confirm.isPending}
        isSnoozing={snooze.isPending}
      />
    </View>
  );
}

// ── Shared "go home" link ─────────────────────────────────────────────────────

interface GoHomeLinkProps {
  onPress: () => void;
  color: string;
  label: string;
}

function GoHomeLink({ onPress, color, label }: GoHomeLinkProps) {
  const { t } = useTranslation();
  return (
    <Text
      size={FontSizes.patient.body}
      weight="semibold"
      color={color}
      style={styles.backLink}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('patient.reminder.goHomeLabel')}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  backLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
});
