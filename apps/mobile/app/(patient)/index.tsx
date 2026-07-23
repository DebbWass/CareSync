/**
 * Patient home — shows the current pending medication reminder.
 * If no reminder is active, shows an "all clear" state.
 * Polls every 60 seconds for new events (see usePendingEvent).
 */
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReminderCard } from '../../src/components/patient/ReminderCard';
import { PatientInvitations } from '../../src/components/patient/PatientInvitations';
import { Text } from '../../src/components/ui/Text';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import {
  useConfirmEvent,
  usePendingEvent,
  useSnoozeEvent,
} from '../../src/hooks/useMedicationEvent';
import { usePatientInvitations } from '../../src/hooks/usePatients';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Colors } from '../../src/constants/colors';
import { FontSizes } from '../../src/constants/typography';

export default function PatientHome() {
  const { t } = useTranslation();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;

  const { data: event, isLoading, error, refetch } = usePendingEvent();
  const { data: invitations = [] } = usePatientInvitations();
  const confirm = useConfirmEvent();
  const snooze = useSnoozeEvent();

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <ErrorBanner error={error} onRetry={refetch} />
      </View>
    );
  }

  // ── Active reminder ─────────────────────────────────────────────────────────
  if (event) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        {/* A failed confirm/snooze rolls the card back — tell the patient why */}
        <ErrorBanner error={confirm.error ?? snooze.error} />
        <ReminderCard
          event={event}
          onConfirm={() => confirm.mutate(event.id)}
          onSnooze={(minutes) => {
            void minutes; // snooze duration passed to Edge Function via DB event
            snooze.mutate(event.id);
          }}
          isConfirming={confirm.isPending}
          isSnoozing={snooze.isPending}
        />
      </View>
    );
  }

  // ── Pending caregiver invitations ────────────────────────────────────────────
  // Shown only when no dose is due — a medication reminder always takes priority.
  if (invitations.length > 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <PatientInvitations invitations={invitations} />
      </View>
    );
  }

  // ── All clear ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text
        size={72}
        weight="bold"
        color={theme.confirm}
        accessibilityLabel={t('patient.home.allClearIconLabel')}
      >
        ✓
      </Text>
      <Text
        size={FontSizes.patient.heading}
        weight="bold"
        color={theme.onBackground}
        align="center"
        accessibilityRole="header"
      >
        {t('patient.home.allClearTitle')}
      </Text>
      <Text size={FontSizes.patient.body} color={theme.secondary} align="center">
        {t('patient.home.allClearBody')}
      </Text>
      <Link href="/(patient)/history" asChild>
        <Text
          size={FontSizes.patient.body}
          weight="semibold"
          color={theme.primary}
          style={styles.historyLink}
          accessibilityRole="link"
          accessibilityLabel={t('patient.home.historyLinkLabel')}
          accessibilityHint={t('patient.home.historyLinkHint')}
        >
          {t('patient.home.historyLink')}
        </Text>
      </Link>
    </View>
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
  historyLink: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
