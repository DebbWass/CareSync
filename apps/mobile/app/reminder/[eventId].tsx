/**
 * Deep-link reminder screen — entry point from push notifications.
 *
 * Push payload contains only `event_id` (no PHI — per NF-08).
 * This screen fetches the full event details from Supabase after the user taps.
 *
 * Deep-link URL: caresync://reminder/<eventId>
 */
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReminderCard } from '../../src/components/patient/ReminderCard';
import { useConfirmEvent, useEventById, useSnoozeEvent } from '../../src/hooks/useMedicationEvent';
import { Colors } from '../../src/constants/colors';
import { FontSizes } from '../../src/constants/typography';

export default function ReminderDeepLink() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();

  const { data: event, isLoading, error } = useEventById(eventId ?? null);
  const confirm = useConfirmEvent();
  const snooze = useSnoozeEvent();

  const handleConfirm = () => {
    if (!event) return;
    confirm.mutate(event.id, {
      onSuccess: () => {
        // Return to patient home after confirming
        router.replace('/(patient)');
      },
    });
  };

  const handleSnooze = (_minutes: number) => {
    if (!event) return;
    snooze.mutate(event.id, {
      onSuccess: () => {
        router.replace('/(patient)');
      },
    });
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  // ── Error / not found ───────────────────────────────────────────────────────
  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle} accessibilityRole="alert">
          Reminder not found
        </Text>
        <Text style={styles.errorBody}>
          This reminder may have already been confirmed or expired.
        </Text>
        <Text
          style={styles.backLink}
          onPress={() => router.replace('/(patient)')}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          ← Go home
        </Text>
      </View>
    );
  }

  // ── Already taken ───────────────────────────────────────────────────────────
  if (event.status === 'taken') {
    return (
      <View style={[styles.center, { backgroundColor: Colors.light.confirm }]}>
        <Text style={styles.takenIcon}>✓</Text>
        <Text style={styles.takenTitle}>Already confirmed!</Text>
        <Text style={styles.takenBody}>
          This medication was recorded as taken.
        </Text>
        <Text
          style={styles.backLinkLight}
          onPress={() => router.replace('/(patient)')}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
          ← Go home
        </Text>
      </View>
    );
  }

  // ── Active reminder ─────────────────────────────────────────────────────────
  return (
    <ReminderCard
      event={event}
      onConfirm={handleConfirm}
      onSnooze={handleSnooze}
      isConfirming={confirm.isPending}
      isSnoozeing={snooze.isPending}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: FontSizes.patient.heading,
    fontWeight: '700',
    color: Colors.light.onBackground,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: FontSizes.patient.body,
    color: Colors.light.secondary,
    textAlign: 'center',
    lineHeight: FontSizes.patient.body * 1.5,
  },
  backLink: {
    fontSize: FontSizes.patient.body,
    color: Colors.light.primary,
    fontWeight: '600',
    marginTop: 16,
    paddingVertical: 8,
  },
  takenIcon: {
    fontSize: 72,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  takenTitle: {
    fontSize: FontSizes.patient.heading,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  takenBody: {
    fontSize: FontSizes.patient.body,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  backLinkLight: {
    fontSize: FontSizes.patient.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 16,
    paddingVertical: 8,
  },
});
