/**
 * ReminderCard — the fullscreen medication reminder UI.
 *
 * Accessibility requirements (from requirements.md):
 *  - Medication name: 48sp
 *  - Dosage: 28sp, instructions: 24sp, time: 36sp
 *  - Confirm button: full-width, min 80dp height
 *  - All elements have accessibilityLabel + accessibilityHint
 *  - High-contrast mode supported via settingsStore
 *  - No color as sole indicator of state (icons + text always accompany color)
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { format } from 'date-fns';
import { Colors } from '../../constants/colors';
import { FontSizes, FontWeights } from '../../constants/typography';
import { SNOOZE_LIMIT, SNOOZE_OPTIONS_MINUTES, PATIENT_PRIMARY_BUTTON_HEIGHT_DP } from '../../constants/config';
import { useSettingsStore } from '../../store/settingsStore';
import type { MedicationEvent } from '../../types';

interface ReminderCardProps {
  event: MedicationEvent;
  onConfirm: () => void;
  onSnooze: (minutes: number) => void;
  isConfirming?: boolean;
  isSnoozeing?: boolean;
}

export function ReminderCard({
  event,
  onConfirm,
  onSnooze,
  isConfirming = false,
  isSnoozeing = false,
}: ReminderCardProps) {
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;

  const [selectedSnooze, setSelectedSnooze] = useState<number | null>(null);

  const medication = event.medications;
  const scheduledTime = format(new Date(event.scheduled_time), 'h:mm a');
  const snoozesRemaining = Math.max(0, SNOOZE_LIMIT - event.snooze_count);
  const canSnooze = snoozesRemaining > 0 && event.status !== 'taken';

  const handleSnooze = (minutes: number) => {
    setSelectedSnooze(minutes);
    onSnooze(minutes);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      accessibilityViewIsModal
    >
      {/* Time indicator */}
      <Text
        style={[styles.timeText, { color: theme.secondary }]}
        accessibilityLabel={`Scheduled at ${scheduledTime}`}
      >
        {scheduledTime}
      </Text>

      <Text style={[styles.reminderLabel, { color: theme.secondary }]}>
        TIME TO TAKE YOUR MEDICATION
      </Text>

      {/* Medication card */}
      <View style={[styles.medicationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text
          style={[styles.medicationName, { color: theme.primary }]}
          accessibilityRole="header"
          accessibilityLabel={`Medication: ${medication?.name ?? 'Unknown'}`}
        >
          {medication?.name ?? '—'}
        </Text>

        <Text
          style={[styles.dosage, { color: theme.onSurface }]}
          accessibilityLabel={`Dosage: ${medication?.dosage ?? ''}`}
        >
          {medication?.dosage ?? ''}
        </Text>

        {medication?.instructions ? (
          <Text
            style={[styles.instructions, { color: theme.secondary }]}
            accessibilityLabel={`Instructions: ${medication.instructions}`}
          >
            {medication.instructions}
          </Text>
        ) : null}
      </View>

      {/* Confirm button */}
      <TouchableOpacity
        style={[
          styles.confirmButton,
          { backgroundColor: theme.confirm },
          isConfirming && styles.buttonDisabled,
        ]}
        onPress={onConfirm}
        disabled={isConfirming || isSnoozeing}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Medication taken"
        accessibilityHint="Double tap to confirm you have taken this medication"
        accessibilityState={{ disabled: isConfirming || isSnoozeing }}
      >
        {isConfirming ? (
          <ActivityIndicator color={theme.onConfirm} size="large" />
        ) : (
          <Text style={[styles.confirmButtonText, { color: theme.onConfirm }]}>
            ✓ MEDICATION TAKEN
          </Text>
        )}
      </TouchableOpacity>

      {/* Snooze section */}
      {canSnooze ? (
        <View style={styles.snoozeSection}>
          <Text style={[styles.snoozeLabel, { color: theme.secondary }]}>
            Remind me in:
          </Text>

          <View style={styles.snoozeRow}>
            {SNOOZE_OPTIONS_MINUTES.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.snoozeButton,
                  { borderColor: theme.snooze },
                  isSnoozeing && selectedSnooze === minutes && styles.buttonDisabled,
                ]}
                onPress={() => handleSnooze(minutes)}
                disabled={isConfirming || isSnoozeing}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Snooze for ${minutes} minutes`}
                accessibilityHint={`Double tap to be reminded again in ${minutes} minutes`}
                accessibilityState={{ disabled: isConfirming || isSnoozeing }}
              >
                {isSnoozeing && selectedSnooze === minutes ? (
                  <ActivityIndicator color={theme.snooze} size="small" />
                ) : (
                  <Text style={[styles.snoozeButtonText, { color: theme.snooze }]}>
                    {minutes} min
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={[styles.snoozesRemaining, { color: theme.secondary }]}
            accessibilityLabel={`${snoozesRemaining} snooze${snoozesRemaining !== 1 ? 's' : ''} remaining before your caregiver is notified`}
          >
            {snoozesRemaining === 1
              ? '1 snooze remaining — caregiver will be notified after this'
              : `${snoozesRemaining} snoozes remaining`}
          </Text>
        </View>
      ) : (
        <View style={styles.snoozeSection}>
          <Text
            style={[styles.snoozeExhausted, { color: theme.danger }]}
            accessibilityRole="alert"
            accessibilityLabel="Snooze limit reached. Your caregiver has been notified."
          >
            ⚠ Snooze limit reached — your caregiver has been notified
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 20,
  },
  timeText: {
    fontSize: FontSizes.patient.timeIndicator,
    fontWeight: FontWeights.bold,
  },
  reminderLabel: {
    fontSize: 14,
    fontWeight: FontWeights.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  medicationCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  medicationName: {
    fontSize: FontSizes.patient.medicationName,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
    lineHeight: FontSizes.patient.medicationName * 1.2,
  },
  dosage: {
    fontSize: FontSizes.patient.dosage,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
  instructions: {
    fontSize: FontSizes.patient.instructions,
    textAlign: 'center',
    lineHeight: FontSizes.patient.instructions * 1.5,
  },
  confirmButton: {
    width: '100%',
    minHeight: PATIENT_PRIMARY_BUTTON_HEIGHT_DP,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  confirmButtonText: {
    fontSize: FontSizes.patient.confirmButton,
    fontWeight: FontWeights.bold,
    letterSpacing: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  snoozeSection: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  snoozeLabel: {
    fontSize: FontSizes.patient.body,
    fontWeight: FontWeights.medium,
  },
  snoozeRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  snoozeButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeButtonText: {
    fontSize: FontSizes.patient.snoozeButton,
    fontWeight: FontWeights.semibold,
  },
  snoozesRemaining: {
    fontSize: FontSizes.patient.caption,
    textAlign: 'center',
    lineHeight: FontSizes.patient.caption * 1.5,
  },
  snoozeExhausted: {
    fontSize: FontSizes.patient.body,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
});
