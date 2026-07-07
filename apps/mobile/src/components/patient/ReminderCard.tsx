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
 *
 * All copy renders through t() (patient.reminder.*); sizes route through the
 * design-system <Text/>, which multiplies by the user's font-scale setting.
 */
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Colors } from '../../constants/colors';
import { FontSizes } from '../../constants/typography';
import { SNOOZE_LIMIT, SNOOZE_OPTIONS_MINUTES } from '../../constants/config';
import { useSettingsStore } from '../../store/settingsStore';
import type { MedicationEvent } from '../../types';

interface ReminderCardProps {
  event: MedicationEvent;
  onConfirm: () => void;
  onSnooze: (minutes: number) => void;
  isConfirming?: boolean;
  isSnoozing?: boolean;
}

export function ReminderCard({
  event,
  onConfirm,
  onSnooze,
  isConfirming = false,
  isSnoozing = false,
}: ReminderCardProps) {
  const { t } = useTranslation();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;

  const [selectedSnooze, setSelectedSnooze] = useState<number | null>(null);

  const medication = event.medications;
  const scheduledTime = format(new Date(event.scheduled_time), 'h:mm a');
  const snoozesRemaining = Math.max(0, SNOOZE_LIMIT - event.snooze_count);
  const canSnooze = snoozesRemaining > 0 && event.status !== 'taken';
  const busy = isConfirming || isSnoozing;

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
        size={FontSizes.patient.timeIndicator}
        weight="bold"
        color={theme.secondary}
        accessibilityLabel={t('patient.reminder.scheduledAtA11y', { time: scheduledTime })}
      >
        {scheduledTime}
      </Text>

      <Text size={14} weight="semibold" color={theme.secondary} style={styles.reminderLabel}>
        {t('patient.reminder.timeToTake')}
      </Text>

      {/* Medication card */}
      <View
        style={[
          styles.medicationCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text
          size={FontSizes.patient.medicationName}
          weight="bold"
          color={theme.primary}
          align="center"
          accessibilityRole="header"
          accessibilityLabel={t('patient.reminder.medicationA11y', {
            name: medication?.name ?? t('patient.reminder.unknownMedication'),
          })}
        >
          {medication?.name ?? '—'}
        </Text>

        <Text
          size={FontSizes.patient.dosage}
          weight="semibold"
          color={theme.onSurface}
          align="center"
          accessibilityLabel={t('patient.reminder.dosageA11y', {
            dosage: medication?.dosage ?? '',
          })}
        >
          {medication?.dosage ?? ''}
        </Text>

        {medication?.instructions ? (
          <Text
            size={FontSizes.patient.instructions}
            color={theme.secondary}
            align="center"
            accessibilityLabel={t('patient.reminder.instructionsA11y', {
              instructions: medication.instructions,
            })}
          >
            {medication.instructions}
          </Text>
        ) : null}
      </View>

      {/* Confirm button — the primary action, 80dp min height via size='large' */}
      <Button
        label={t('patient.reminder.confirmButton')}
        onPress={onConfirm}
        variant="confirm"
        size="large"
        textSize={FontSizes.patient.confirmButton}
        loading={isConfirming}
        disabled={isSnoozing}
        accessibilityLabel={t('patient.reminder.confirmLabel')}
        accessibilityHint={t('patient.reminder.confirmHint')}
      />

      {/* Snooze section */}
      {canSnooze ? (
        <View style={styles.snoozeSection}>
          <Text size={FontSizes.patient.body} weight="medium" color={theme.secondary}>
            {t('patient.reminder.snoozeTitle')}
          </Text>

          <View style={styles.snoozeRow}>
            {SNOOZE_OPTIONS_MINUTES.map((minutes) => (
              <TouchableOpacity
                key={minutes}
                style={[
                  styles.snoozeButton,
                  { borderColor: theme.snooze },
                  isSnoozing && selectedSnooze === minutes && styles.buttonDisabled,
                ]}
                onPress={() => handleSnooze(minutes)}
                disabled={busy}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('patient.reminder.snoozeLabel', { minutes })}
                accessibilityHint={t('patient.reminder.snoozeHint', { minutes })}
                accessibilityState={{ disabled: busy }}
              >
                {isSnoozing && selectedSnooze === minutes ? (
                  <ActivityIndicator color={theme.snooze} size="small" />
                ) : (
                  <Text
                    size={FontSizes.patient.snoozeButton}
                    weight="semibold"
                    color={theme.snooze}
                  >
                    {t('patient.reminder.snoozeMinutes', { minutes })}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Text
            size={FontSizes.patient.caption}
            color={theme.secondary}
            align="center"
            accessibilityLabel={t('patient.reminder.snoozesRemainingA11y', {
              count: snoozesRemaining,
            })}
          >
            {t('patient.reminder.snoozesRemaining', { count: snoozesRemaining })}
          </Text>
        </View>
      ) : (
        <View style={styles.snoozeSection}>
          <Text
            size={FontSizes.patient.body}
            weight="semibold"
            color={theme.danger}
            align="center"
            accessibilityRole="alert"
            accessibilityLabel={t('patient.reminder.snoozeLimitReachedA11y')}
          >
            {t('patient.reminder.snoozeLimitReached')}
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
  reminderLabel: {
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
  buttonDisabled: {
    opacity: 0.6,
  },
  snoozeSection: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
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
});
