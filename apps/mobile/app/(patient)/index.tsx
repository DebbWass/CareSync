/**
 * Patient home — shows the current pending medication reminder.
 * If no reminder is active, shows an "all clear" state.
 * Polls every 60 seconds for new events (see usePendingEvent).
 */
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { ReminderCard } from '../../src/components/patient/ReminderCard';
import {
  useConfirmEvent,
  usePendingEvent,
  useSnoozeEvent,
} from '../../src/hooks/useMedicationEvent';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Colors } from '../../src/constants/colors';
import { FontSizes } from '../../src/constants/typography';

export default function PatientHome() {
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;

  const { data: event, isLoading, error } = usePendingEvent();
  const confirm = useConfirmEvent();
  const snooze = useSnoozeEvent();

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.primary }]}>
        <ActivityIndicator size="large" color={theme.onPrimary} />
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]} accessibilityRole="alert">
          Could not load reminders. Please check your connection.
        </Text>
      </View>
    );
  }

  // ── Active reminder ─────────────────────────────────────────────────────────
  if (event) {
    return (
      <ReminderCard
        event={event}
        onConfirm={() => confirm.mutate(event.id)}
        onSnooze={(minutes) => {
          void minutes; // snooze duration passed to Edge Function via DB event
          snooze.mutate(event.id);
        }}
        isConfirming={confirm.isPending}
        isSnoozeing={snooze.isPending}
      />
    );
  }

  // ── All clear ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <Text
        style={[styles.allClearIcon, { color: theme.confirm }]}
        accessibilityLabel="All clear"
      >
        ✓
      </Text>
      <Text
        style={[styles.allClearTitle, { color: theme.onBackground }]}
        accessibilityRole="header"
      >
        All good!
      </Text>
      <Text style={[styles.allClearBody, { color: theme.secondary }]}>
        No medications due right now.
      </Text>
      <Link href="/(patient)/history" asChild>
        <Text
          style={[styles.historyLink, { color: theme.primary }]}
          accessibilityRole="link"
          accessibilityLabel="View medication history"
          accessibilityHint="Double tap to open your past medication records"
        >
          View history →
        </Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  allClearIcon: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 80,
  },
  allClearTitle: {
    fontSize: FontSizes.patient.heading,
    fontWeight: '700',
    textAlign: 'center',
  },
  allClearBody: {
    fontSize: FontSizes.patient.body,
    textAlign: 'center',
  },
  historyLink: {
    fontSize: FontSizes.patient.body,
    fontWeight: '600',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: FontSizes.patient.body,
    textAlign: 'center',
    lineHeight: FontSizes.patient.body * 1.5,
  },
});
